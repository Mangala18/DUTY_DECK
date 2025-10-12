/**
 * Dialog Utility Module
 * Confirmation modals with proper cleanup to avoid memory leaks
 */

import { showToast } from './ui.js';

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @param {string} title - Dialog title (default: 'Confirm')
 * @returns {Promise<boolean>} True if user confirms, false otherwise
 *
 * @example
 * const confirmed = await confirmAction('Delete this staff member?', 'Confirm Deletion');
 * if (confirmed) {
 *   // Proceed with deletion
 * }
 */
export async function confirmAction(message, title = 'Confirm') {
  return new Promise(resolve => {
    // Create wrapper div
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">${title}</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">${message}</p>
            </div>
            <div class="modal-footer">
              <button id="confirmNo" class="btn btn-secondary" data-bs-dismiss="modal">No</button>
              <button id="confirmYes" class="btn btn-danger">Yes</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const modalEl = wrapper.firstElementChild;
    document.body.appendChild(wrapper);

    // Initialize Bootstrap modal
    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    // Cleanup function to remove modal from DOM and dispose Bootstrap instance
    const cleanup = (result) => {
      modalEl.addEventListener('hidden.bs.modal', () => {
        try {
          bsModal.dispose();
        } catch (e) {
          console.warn('Error disposing modal:', e);
        }
        wrapper.remove();
        resolve(result);
      }, { once: true });
    };

    // Yes button click handler
    modalEl.querySelector('#confirmYes').addEventListener('click', () => {
      bsModal.hide();
      cleanup(true);
    }, { once: true });

    // No button click handler
    modalEl.querySelector('#confirmNo').addEventListener('click', () => {
      bsModal.hide();
      cleanup(false);
    }, { once: true });

    // Handle modal close via X button or backdrop
    modalEl.addEventListener('hide.bs.modal', (e) => {
      // If not already handled by Yes/No buttons
      if (e.target === modalEl && !e.defaultPrevented) {
        cleanup(false);
      }
    }, { once: true });
  });
}

/**
 * Show alert dialog (informational, single OK button)
 * @param {string} message - Alert message
 * @param {string} title - Dialog title (default: 'Alert')
 * @param {string} type - Alert type: 'info', 'success', 'warning', 'danger' (default: 'info')
 * @returns {Promise<void>}
 */
export async function alertDialog(message, title = 'Alert', type = 'info') {
  return new Promise(resolve => {
    const wrapper = document.createElement('div');

    const typeClasses = {
      info: 'text-bg-info',
      success: 'text-bg-success',
      warning: 'text-bg-warning',
      danger: 'text-bg-danger'
    };

    const headerClass = typeClasses[type] || typeClasses.info;

    wrapper.innerHTML = `
      <div class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header ${headerClass}">
              <h5 class="modal-title">${title}</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">${message}</p>
            </div>
            <div class="modal-footer">
              <button id="alertOk" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const modalEl = wrapper.firstElementChild;
    document.body.appendChild(wrapper);

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    // Cleanup
    const cleanup = () => {
      modalEl.addEventListener('hidden.bs.modal', () => {
        try {
          bsModal.dispose();
        } catch (e) {
          console.warn('Error disposing modal:', e);
        }
        wrapper.remove();
        resolve();
      }, { once: true });
    };

    modalEl.querySelector('#alertOk').addEventListener('click', () => {
      bsModal.hide();
      cleanup();
    }, { once: true });

    modalEl.addEventListener('hide.bs.modal', (e) => {
      if (e.target === modalEl) {
        cleanup();
      }
    }, { once: true });
  });
}

export default {
  confirmAction,
  alertDialog
};
