import { apiRequest } from '../utils/api.js';
import { showToast, Loading } from '../utils/ui.js';
import { Storage } from '../utils/storage.js';

let currentFrom = '';
let currentTo = '';

/**
 * Initialize payroll module
 * Sets up event listeners and loads initial data
 */
export function initPayroll() {
  console.log('Initializing payroll module...');

  // Set default date range to current week (Monday to Sunday)
  setDefaultDateRange();

  // Load initial payroll summary
  loadPayrollSummary();

  // Attach filter button event listener
  const filterBtn = document.getElementById('filterPayrollBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      currentFrom = document.getElementById('payrollFrom').value || '';
      currentTo = document.getElementById('payrollTo').value || '';
      loadPayrollSummary();
    });
  }
}

/**
 * Set default date range to current week (Monday to Sunday)
 */
function setDefaultDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate Monday of current week
  const monday = new Date(today);
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(today.getDate() + daysToMonday);

  // Calculate Sunday of current week
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  // Format dates as YYYY-MM-DD
  const formatDate = (date) => date.toISOString().split('T')[0];

  currentFrom = formatDate(monday);
  currentTo = formatDate(sunday);

  // Set input values
  const fromInput = document.getElementById('payrollFrom');
  const toInput = document.getElementById('payrollTo');

  if (fromInput) fromInput.value = currentFrom;
  if (toInput) toInput.value = currentTo;
}

/**
 * Load payroll summary for all staff
 * Shows staff list with total hours, pay, and shifts
 */
export async function loadPayrollSummary() {
  try {
    Loading.show('Loading payroll summary...');

    // Get business code from storage
    const businessCode = Storage.getUserBusinessCode();
    console.log('[Payroll] Current business_code:', businessCode);

    if (!businessCode) {
      showToast('Missing business context. Please log in again.', 'error');
      Loading.hide();
      return;
    }

    console.log('[Payroll] Fetching payroll summary with params:', { businessCode, from: currentFrom, to: currentTo });
    const res = await apiRequest(`/system-admin/payroll/staff?business_code=${businessCode}&from=${currentFrom}&to=${currentTo}`);
    const container = document.getElementById('payrollStaffList');

    if (!container) {
      console.error('Payroll staff list container not found');
      return;
    }

    if (!res.success || !res.data?.length) {
      container.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-wallet display-1 mb-3"></i>
          <h5>No approved shifts found</h5>
          <p>No approved shifts found in this date range.</p>
        </div>`;
      return;
    }

    // Render staff list
    let html = '<ul class="list-group list-group-flush">';
    res.data.forEach(staff => {
      html += `
        <li class="list-group-item staff-item" data-staff="${staff.staff_code}">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <strong>${staff.name}</strong><br>
              <small class="text-muted">
                ${staff.total_shifts} shift${staff.total_shifts !== 1 ? 's' : ''} •
                ${parseFloat(staff.total_hours).toFixed(2)} hrs
              </small><br>
              <small class="text-muted">Breaks: ${staff.total_break_minutes} min</small>
            </div>
            <div class="text-end fw-bold text-success">
              $${parseFloat(staff.total_pay).toFixed(2)}
            </div>
          </div>
        </li>`;
    });
    html += '</ul>';
    container.innerHTML = html;

    // Attach click event listeners to staff items
    document.querySelectorAll('.staff-item').forEach(item =>
      item.addEventListener('click', () => togglePayrollBreakdown(item))
    );

    showToast('Payroll summary loaded successfully', 'success');
  } catch (err) {
    console.error('Error loading payroll summary:', err);
    showToast('Failed to load payroll summary', 'error');
  } finally {
    Loading.hide();
  }
}

/**
 * Toggle payroll breakdown for a staff member
 * Shows/hides detailed shift information
 *
 * @param {HTMLElement} item - The staff list item that was clicked
 */
async function togglePayrollBreakdown(item) {
  const staffCode = item.dataset.staff;
  const expanded = item.classList.contains('expanded');

  // Collapse any currently open breakdowns
  document.querySelectorAll('.staff-item.expanded').forEach(el => {
    el.classList.remove('expanded');
    el.querySelector('.breakdown')?.remove();
  });

  // If this item was already expanded, just collapse it
  if (expanded) return;

  // Expand this item
  item.classList.add('expanded');

  try {
    Loading.show('Loading shift details...');

    // Get business code from storage
    const businessCode = Storage.getUserBusinessCode();
    console.log('[Payroll Breakdown] Current business_code:', businessCode);

    if (!businessCode) {
      showToast('Missing business context. Please log in again.', 'error');
      Loading.hide();
      return;
    }

    console.log('[Payroll Breakdown] Fetching breakdown with params:', { staffCode, businessCode, from: currentFrom, to: currentTo });
    const res = await apiRequest(
      `/system-admin/payroll/breakdown?staff_code=${staffCode}&business_code=${businessCode}&from=${currentFrom}&to=${currentTo}`
    );

    if (!res.success || !res.data?.length) {
      item.insertAdjacentHTML(
        'beforeend',
        `<div class="breakdown text-muted py-2 px-3 small">No shift data available.</div>`
      );
      return;
    }

    // Calculate totals
    let totalHours = 0;
    let totalPay = 0;
    let totalBreak = 0;

    // Build breakdown table
    let html = `
      <div class="breakdown mt-3 border-top pt-3">
        <table class="table table-sm table-borderless mb-0">
          <thead class="text-muted small">
            <tr>
              <th>Date</th>
              <th>Start</th>
              <th>End</th>
              <th>Break</th>
              <th>Hours</th>
              <th>Pay</th>
              <th>Venue</th>
            </tr>
          </thead>
          <tbody>`;

    res.data.forEach(shift => {
      totalHours += parseFloat(shift.hours_worked);
      totalPay += parseFloat(shift.total_pay);
      totalBreak += shift.break_minutes || 0;

      // Format date nicely
      const shiftDate = new Date(shift.shift_date + 'T00:00:00');
      const formattedDate = shiftDate.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      html += `
        <tr>
          <td>${formattedDate}</td>
          <td>${shift.start_time}</td>
          <td>${shift.end_time}</td>
          <td>${shift.break_minutes || 0} min</td>
          <td>${parseFloat(shift.hours_worked).toFixed(2)}</td>
          <td>$${parseFloat(shift.total_pay).toFixed(2)}</td>
          <td><small class="text-muted">${shift.venue_name}</small></td>
        </tr>`;
    });

    html += `
          </tbody>
          <tfoot class="border-top fw-bold">
            <tr>
              <td colspan="3">Totals:</td>
              <td>${totalBreak} min</td>
              <td>${totalHours.toFixed(2)} hrs</td>
              <td>$${totalPay.toFixed(2)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;

    item.insertAdjacentHTML('beforeend', html);
  } catch (err) {
    console.error('Error loading payroll breakdown:', err);
    showToast('Failed to load shift details', 'error');
  } finally {
    Loading.hide();
  }
}

/**
 * Export payroll data (placeholder for future implementation)
 */
export function exportPayroll() {
  showToast('Export functionality coming soon', 'info');
}
