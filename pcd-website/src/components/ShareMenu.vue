<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { toCanvas } from 'qrcode';
import qrIcon from '../images/qr-code-bold-svgrepo-com_MIT_License.svg';
import '../styles/docs/tokens.css';
import '../styles/docs/components.css';

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
let qrBlob: Blob | null = null;
let feedbackTimer: number | undefined;
let qrCopyTimer: number | undefined;

const instanceId = useId().replace(/:/g, '');
const menuId = `share-menu-${instanceId}`;
const qrTitleId = `share-qr-title-${instanceId}`;
const qrInfoId = `share-qr-info-${instanceId}`;
const menuItems = () => Array.from(menuRef.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
const copyButtonLabel = computed(() => qrCopyLabel.value || t('share_menu.copy'));

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
  status.value = '';
  try {
    if (!qrBlob || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      throw new Error('Image clipboard is not supported.');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': qrBlob })]);
    qrCopyLabel.value = t('share_menu.copied');
    status.value = t('share_menu.qr_copied');
    window.clearTimeout(qrCopyTimer);
    qrCopyTimer = window.setTimeout(() => {
      qrCopyLabel.value = '';
    }, 1600);
  } catch {
    status.value = t('share_menu.qr_copy_failed');
  }
}

function downloadQrCode() {
  if (!qrBlob) {
    status.value = t('share_menu.qr_download_failed');
    return;
  }

  const downloadUrl = URL.createObjectURL(qrBlob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = props.qrFilename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
  status.value = t('share_menu.qr_downloaded');
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
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M15 3a3 3 0 0 1-5.175 2.066l-3.92 2.179a2.994 2.994 0 0 1 0 1.51l3.92 2.179a3 3 0 1 1-.73 1.31l-3.92-2.178a3 3 0 1 1 0-4.133l3.92-2.178A3 3 0 1 1 15 3Zm-1.5 10a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 13.5 13Zm-9-5a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 4.5 8Zm9-5a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 13.5 3Z" />
      </svg>
      <span>{{ t('share_menu.share') }}</span>
      <svg class="share-menu__chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M4.22 6.47a.75.75 0 0 1 1.06 0L8 9.19l2.72-2.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-3.25 3.25a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 0 1 0-1.06Z" />
      </svg>
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
        @touchend.stop.prevent="copyMarkdown"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M14.85 3c.63 0 1.15.52 1.14 1.15v7.7c0 .63-.51 1.15-1.15 1.15H1.15C.52 13 0 12.48 0 11.84V4.15C0 3.52.52 3 1.15 3ZM9 11V5H7L5.5 7 4 5H2v6h2V8l1.5 1.92L7 8v3Zm2.99.5L14.5 8H13V5h-2v3H9.5Z" />
        </svg>
        <span>{{ t('share_menu.copy_markdown') }}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        @click="copyPermalink"
        @touchend.stop.prevent="copyPermalink"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z" />
        </svg>
        <span>{{ t('share_menu.copy_permalink') }}</span>
      </button>
      <button type="button" role="menuitem" @click="showQrCode" @touchend.stop.prevent="showQrCode">
        <img :src="qrIcon.src" width="16" height="16" alt="" />
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
        <button ref="dialogCloseRef" class="share-qr-dialog__close" type="button" :aria-label="t('share_menu.close_qr')" @click="closeQrDialog">
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
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                <path fill-rule="evenodd" d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Zm0 1a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM7.25 7a.75.75 0 0 1 .75-.75h.01a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0V7ZM8 3.75a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" clip-rule="evenodd" />
              </svg>
            </button>
            <p :id="qrInfoId" class="share-qr-dialog__tooltip" role="tooltip">
              {{ t('share_menu.qr_help') }}
            </p>
          </div>
          <div class="share-qr-dialog__action-buttons">
            <button type="button" :disabled="!qrReady" @click="copyQrCode">{{ copyButtonLabel }}</button>
            <button type="button" :disabled="!qrReady" @click="downloadQrCode">{{ t('share_menu.download') }}</button>
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>
