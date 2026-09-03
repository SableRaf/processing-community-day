<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toCanvas } from 'qrcode';
import shareIcon from '../icons/share.svg?raw';
import chevronDownIcon from '../icons/chevron-down.svg?raw';
import markdownIcon from '../icons/markdown.svg?raw';
import linkIcon from '../icons/link.svg?raw';
import qrIconRaw from '../icons/qr-code.svg?raw';
import infoIcon from '../icons/info.svg?raw';
import Snackbar from './Snackbar.vue';
import { vTouchActivate } from '../directives/touchActivate';
import '../styles/docs/tokens.css';
import '../styles/docs/components.css';

// The .svg sources carry attribution comments; keep them out of the DOM.
const qrIcon = qrIconRaw.replace(/<!--[\s\S]*?-->/g, '').trim();

const props = withDefaults(defineProps<{
  markdown: string;
  permalink: string;
  qrFilename?: string;
}>(), {
  qrFilename: 'page-qr-code.png',
});

const { t } = useI18n();
const rootRef = ref<HTMLElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLDialogElement | null>(null);
const dialogCloseRef = ref<HTMLButtonElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const qrUrlRef = ref<HTMLInputElement | null>(null);
const menuOpen = ref(false);
const dialogFallbackOpen = ref(false);
const copyFeedbackVisible = ref(false);
const status = ref('');
const qrReady = ref(false);
const qrCopyLabel = ref('');
const snackbar = ref<{ id: number; message: string } | null>(null);
let qrBlob: Blob | null = null;
let feedbackTimer: number | undefined;
let qrCopyTimer: number | undefined;
let snackbarId = 0;

const instanceId = useId().replace(/:/g, '');
const menuId = `share-menu-${instanceId}`;
const qrTitleId = `share-qr-title-${instanceId}`;
const qrInfoId = `share-qr-info-${instanceId}`;
const menuItems = () => Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
const copyButtonLabel = computed(() => qrCopyLabel.value || t('share_menu.copy'));

function showSnackbar(message: string) {
  snackbar.value = { id: ++snackbarId, message };
}

function dismissSnackbar() {
  snackbar.value = null;
}

function fallbackCopy(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = '0';
  textarea.style.fontSize = '16px';

  const activeElement = document.activeElement as HTMLElement | null;
  const selection = document.getSelection();
  const previousRanges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  let copied = false;

  try {
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    copied = document.execCommand('copy');
  } finally {
    textarea.remove();
    activeElement?.focus();
    selection?.removeAllRanges();
    previousRanges.forEach((range) => selection?.addRange(range));
  }

  if (!copied) throw new Error('Copy command failed');
}

async function copyText(text: string) {
  // Only the Clipboard API reports reliable success. execCommand can return
  // true without changing the clipboard, so reserve it for the fallback path.
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission, context, or user-activation failure; try the legacy path.
    }
  }
  fallbackCopy(text);
}

function setMenuOpen(open: boolean, restoreFocus = false) {
  menuOpen.value = open;
  if (restoreFocus) void nextTick(() => triggerRef.value?.focus());
}

async function toggleMenu(event: MouseEvent) {
  setMenuOpen(!menuOpen.value);
  // A keyboard-generated click has detail 0. Keep focus on the trigger for
  // touch/pointer activation because moving it during WebKit's synthesized
  // click sequence can prevent the subsequent menu-item click.
  if (menuOpen.value && event.detail === 0) {
    await nextTick();
    menuItems()[0]?.focus();
  }
}

function copyMarkdown() {
  void announceCopy(
    props.markdown,
    t('share_menu.markdown_copied'),
    t('share_menu.markdown_copy_failed'),
  );
}

function copyPermalink() {
  void announceCopy(
    props.permalink,
    t('share_menu.permalink_copied'),
    t('share_menu.permalink_copy_failed'),
  );
}

async function announceCopy(text: string, successMessage: string, failureMessage: string) {
  setMenuOpen(false, true);
  status.value = '';
  try {
    await copyText(text);
    status.value = successMessage;
    copyFeedbackVisible.value = false;
    await nextTick();
    copyFeedbackVisible.value = true;
    window.clearTimeout(feedbackTimer);
    feedbackTimer = window.setTimeout(() => {
      copyFeedbackVisible.value = false;
    }, 1550);
  } catch {
    status.value = failureMessage;
  }
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  setMenuOpen(true);
  void nextTick(() => {
    const items = menuItems();
    items[event.key === 'ArrowDown' ? 0 : items.length - 1]?.focus();
  });
}

function handleMenuKeydown(event: KeyboardEvent) {
  const items = menuItems();
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  if (currentIndex < 0) return;

  let nextIndex: number | undefined;
  if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length;
  if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = items.length - 1;

  if (nextIndex !== undefined) {
    event.preventDefault();
    items[nextIndex]?.focus();
  }
}

async function showQrCode() {
  setMenuOpen(false);
  status.value = '';
  dismissSnackbar();
  qrBlob = null;
  qrReady.value = false;

  try {
    openQrDialog();
    if (!canvasRef.value) throw new Error('QR canvas is unavailable.');
    await toCanvas(canvasRef.value, props.permalink, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1a1a', light: '#ffffff' },
    });
    canvasRef.value.style.removeProperty('width');
    canvasRef.value.style.removeProperty('height');
    qrBlob = await canvasToPngBlob(canvasRef.value);
    qrReady.value = true;
  } catch {
    closeQrDialog();
    status.value = t('share_menu.qr_generate_failed');
  }
}

function openQrDialog() {
  const dialog = dialogRef.value;
  if (!dialog) throw new Error('QR dialog is unavailable.');

  if (typeof dialog.showModal === 'function') {
    try {
      dialog.showModal();
      return;
    } catch {
      // Fall through to the open-attribute implementation used by older Safari.
    }
  }

  dialogFallbackOpen.value = true;
  dialog.setAttribute('open', '');
  void nextTick(() => dialogCloseRef.value?.focus());
}

function closeQrDialog() {
  const dialog = dialogRef.value;
  if (!dialog) return;

  if (dialogFallbackOpen.value) {
    dialog.removeAttribute('open');
    dialogFallbackOpen.value = false;
    handleDialogClose();
    return;
  }

  if (dialog.open && typeof dialog.close === 'function') dialog.close();
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  if (typeof canvas.toBlob === 'function') {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) return blob;
  }

  const dataUrl = canvas.toDataURL('image/png');
  const encoded = dataUrl.split(',')[1];
  if (!encoded) throw new Error('Could not create a QR code image.');
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}

async function copyQrCode() {
  dismissSnackbar();

  if (!window.isSecureContext) {
    showSnackbar(t('share_menu.qr_copy_requires_https'));
    return;
  }

  try {
    if (!qrBlob || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Image clipboard is not supported.');
    }

    // WebKit preserves user activation only when clipboard representations are
    // created synchronously in the touch/click handler and resolved by promises.
    // Include the URL as a lower-fidelity representation for text-only targets.
    const item = new ClipboardItem({
      'image/png': Promise.resolve(qrBlob),
      'text/plain': Promise.resolve(new Blob([props.permalink], { type: 'text/plain' })),
    });
    await navigator.clipboard.write([item]);
    qrCopyLabel.value = t('share_menu.copied');
    showSnackbar(t('share_menu.qr_copied'));
    window.clearTimeout(qrCopyTimer);
    qrCopyTimer = window.setTimeout(() => {
      qrCopyLabel.value = '';
    }, 1600);
  } catch {
    showSnackbar(t('share_menu.qr_copy_failed'));
  }
}

async function shareQrCode() {
  dismissSnackbar();
  if (!qrBlob) {
    showSnackbar(t('share_menu.qr_share_failed'));
    return;
  }

  if (!window.isSecureContext || typeof navigator.share !== 'function') {
    showSnackbar(t('share_menu.qr_share_unavailable'));
    return;
  }

  const file = new File([qrBlob], props.qrFilename, { type: 'image/png' });
  const canShareFile = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
  const shareData: ShareData = canShareFile
    ? { files: [file], title: document.title }
    : { url: props.permalink, title: document.title };

  try {
    await navigator.share(shareData);
    showSnackbar(t(canShareFile ? 'share_menu.qr_shared' : 'share_menu.qr_link_shared'));
  } catch (error) {
    // Closing the native share sheet is a user choice, not a failure.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    showSnackbar(t('share_menu.qr_share_failed'));
  }
}

function handleDocumentClick(event: MouseEvent) {
  if (!rootRef.value?.contains(event.target as Node)) setMenuOpen(false);
}

function handleDocumentFocus(event: FocusEvent) {
  const target = event.target as Node;
  if (!rootRef.value?.contains(target) || (target !== triggerRef.value && !menuRef.value?.contains(target))) {
    setMenuOpen(false);
  }
}

function handleRootKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && (dialogFallbackOpen.value || dialogRef.value?.open)) {
    event.preventDefault();
    closeQrDialog();
    return;
  }

  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault();
    setMenuOpen(false, true);
  }
}

function handleDialogClick(event: MouseEvent) {
  if (event.target === dialogRef.value) closeQrDialog();
}

function handleDialogClose() {
  triggerRef.value?.focus();
  qrCopyLabel.value = '';
  dismissSnackbar();
}

watch(() => props.permalink, () => {
  setMenuOpen(false);
  if (dialogRef.value?.open) closeQrDialog();
});

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('focusin', handleDocumentFocus);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('focusin', handleDocumentFocus);
  window.clearTimeout(feedbackTimer);
  window.clearTimeout(qrCopyTimer);
});
</script>

<template>
  <div ref="rootRef" class="share-menu" @keydown="handleRootKeydown">
    <button
      ref="triggerRef"
      class="docs-action-button share-menu__trigger"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      :aria-controls="menuId"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <span class="share-menu__icon" aria-hidden="true" v-html="shareIcon"></span>
      <span>{{ t('share_menu.share') }}</span>
      <span class="share-menu__icon share-menu__chevron" aria-hidden="true" v-html="chevronDownIcon"></span>
    </button>

    <div
      :id="menuId"
      ref="menuRef"
      class="share-menu__items"
      role="menu"
      :hidden="!menuOpen"
      @keydown="handleMenuKeydown"
    >
      <button
        type="button"
        role="menuitem"
        @click="copyMarkdown"
        v-touch-activate="copyMarkdown"
      >
        <span class="share-menu__icon" aria-hidden="true" v-html="markdownIcon"></span>
        <span>{{ t('share_menu.copy_markdown') }}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        @click="copyPermalink"
        v-touch-activate="copyPermalink"
      >
        <span class="share-menu__icon" aria-hidden="true" v-html="linkIcon"></span>
        <span>{{ t('share_menu.copy_permalink') }}</span>
      </button>
      <button type="button" role="menuitem" @click="showQrCode" v-touch-activate="showQrCode">
        <span class="share-menu__icon" aria-hidden="true" v-html="qrIcon"></span>
        <span>{{ t('share_menu.show_qr') }}</span>
      </button>
    </div>
    <span
      class="share-menu__feedback"
      :class="{ 'share-menu__feedback--visible': copyFeedbackVisible }"
      aria-hidden="true"
    >{{ t('share_menu.copied') }}</span>

    <p class="share-actions__status" role="status" aria-live="polite">{{ status }}</p>

    <div
      v-if="dialogFallbackOpen"
      class="share-qr-dialog__fallback-backdrop"
      aria-hidden="true"
      @click="closeQrDialog"
    ></div>

    <dialog
      ref="dialogRef"
      class="share-qr-dialog"
      :class="{ 'share-qr-dialog--fallback': dialogFallbackOpen }"
      :aria-labelledby="qrTitleId"
      @click="handleDialogClick"
      @close="handleDialogClose"
    >
      <div class="share-qr-dialog__header">
        <h2 :id="qrTitleId">{{ t('share_menu.scan_qr') }}</h2>
        <button ref="dialogCloseRef" class="modal-close-button share-qr-dialog__close" type="button" :aria-label="t('share_menu.close_qr')" @click="closeQrDialog">
          &times;
        </button>
      </div>
      <div class="share-qr-dialog__body">
        <div class="share-qr-dialog__code">
          <canvas
            ref="canvasRef"
            width="512"
            height="512"
            role="img"
            :aria-label="t('share_menu.qr_code_for', { permalink })"
          ></canvas>
        </div>

        <label class="share-qr-dialog__url">
          <span class="share-qr-dialog__url-label">{{ t('share_menu.encoded_link') }}</span>
          <input ref="qrUrlRef" type="url" :value="permalink" readonly @click="qrUrlRef?.select()" />
        </label>

        <div class="share-qr-dialog__actions">
          <div class="share-qr-dialog__info-control">
            <button
              class="share-qr-dialog__info-button"
              type="button"
              :aria-label="t('share_menu.about_scanning')"
              :aria-describedby="qrInfoId"
            >
              <span class="share-menu__icon share-menu__info-icon" aria-hidden="true" v-html="infoIcon"></span>
            </button>
            <p :id="qrInfoId" class="share-qr-dialog__tooltip" role="tooltip">
              {{ t('share_menu.qr_help') }}
            </p>
          </div>
          <div class="share-qr-dialog__action-buttons">
            <button type="button" :disabled="!qrReady" @click="copyQrCode" v-touch-activate="copyQrCode">{{ copyButtonLabel }}</button>
            <button type="button" :disabled="!qrReady" @click="shareQrCode" v-touch-activate="shareQrCode">{{ t('share_menu.share') }}</button>
          </div>
        </div>
      </div>
      <Snackbar
        v-if="snackbar"
        :key="snackbar.id"
        :message="snackbar.message"
        :close-label="t('share_menu.dismiss_notification')"
        @dismiss="dismissSnackbar"
      />
    </dialog>
  </div>
</template>
