// Initialize Stripe (replace with your publishable key)
const stripe = Stripe('pk_test_your_stripe_publishable_key_here');  // Replace with your actual Stripe publishable key
const elements = stripe.elements();
const cardElement = elements.create('card');
cardElement.mount('#card-element');

const form = document.getElementById('orderForm');
const addBtn = document.getElementById('addMedicine');
const medicinesDiv = document.getElementById('medicines');
const paymentMethodSelect = document.getElementById('paymentMethod');
const stripeCardElement = document.getElementById('stripeCardElement');
const orderSummary = document.getElementById('orderSummary');  // New: For order summary
const summaryMedicines = document.getElementById('summaryMedicines');  // New
const summaryPayment = document.getElementById('summaryPayment');  // New
const summaryTotal = document.getElementById('summaryTotal');  // New
const submitBtn = document.getElementById('submitBtn');  // New: For loading state
const loading = document.getElementById('loading');  // New: Loading spinner

// Function to update order summary (New)
function updateSummary() {
  if (!orderSummary) return;  // Skip if not on order page
  const medicines = Array.from(document.querySelectorAll('.medicine-item')).map(item => ({
    name: item.querySelector('.medName').value,
    quantity: parseInt(item.querySelector('.medQty').value) || 0
  })).filter(m => m.name && m.quantity > 0);

  const total = medicines.reduce((sum, m) => sum + (m.quantity * 10), 0);  // Example: $10 per unit
  const payment = paymentMethodSelect.value === 'online' ? 'Online Payment (Card)' : 'Cash on Delivery (COD)';

  summaryMedicines.textContent = `Medicines: ${medicines.map(m => `${m.name} x${m.quantity}`).join(', ') || 'None'}`;
  summaryPayment.textContent = `Payment Method: ${payment}`;
  summaryTotal.textContent = `Total: $${total.toFixed(2)}`;

  orderSummary.style.display = medicines.length > 0 ? 'block' : 'none';
  stripeCardElement.style.display = paymentMethodSelect.value === 'online' ? 'block' : 'none';
}

// Show/hide Stripe card input and update summary (Merged)
if (paymentMethodSelect) {
  paymentMethodSelect.addEventListener('change', updateSummary);
}

// Add medicine dynamically (Your original, with summary update)
if (addBtn) {
  addBtn.addEventListener('click', () => {
    const item = document.createElement('div');
    item.className = 'medicine-item';
    item.innerHTML = `
      <input type="text" placeholder="Medicine Name" class="medName" required>
      <input type="number" placeholder="Quantity" class="medQty" min="1" required>
      <button type="button" class="remove-med"><i class="fas fa-trash"></i></button>
    `;
    medicinesDiv.appendChild(item);
    item.querySelector('.remove-med').addEventListener('click', () => {
      item.remove();
      updateSummary();  // Update summary after removal
    });
    updateSummary();  // Update summary after addition
  });
}

// Form submission (Your original, with new features)
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Check form validity (New: Prevents silent failures)
    if (!form.checkValidity()) {
      alert('Please fill in all required fields.');
      return;
    }

    // Show loading (New)
    submitBtn.disabled = true;
    loading.style.display = 'block';

    const formData = new FormData();
    formData.append('customerName', document.getElementById('customerName').value);
    formData.append('customerEmail', document.getElementById('customerEmail').value);
    formData.append('customerPhone', document.getElementById('customerPhone').value);
    formData.append('customerAddress', document.getElementById('customerAddress').value);

    const medicines = Array.from(document.querySelectorAll('.medicine-item')).map(item => ({
      name: item.querySelector('.medName').value,
      quantity: parseInt(item.querySelector('.medQty').value)
    }));
    formData.append('medicines', JSON.stringify(medicines));

    const prescription = document.getElementById('prescription').files[0];
    if (prescription) formData.append('prescription', prescription);

    formData.append('paymentMethod', paymentMethodSelect.value);

    // Handle online payment (Your original)
    if (paymentMethodSelect.value === 'online') {
      const amount = medicines.reduce((sum, m) => sum + (m.quantity * 1000), 0);  // In cents
      try {
        const response = await fetch('/api/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount })
        });
        if (!response.ok) throw new Error('Failed to create payment intent');
        const { clientSecret } = await response.json();

        const { error } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card: cardElement }
        });

        if (error) {
          alert(`Payment failed: ${error.message}`);
          submitBtn.disabled = false;
          loading.style.display = 'none';
          return;
        }
      } catch (err) {
        console.error('Payment error:', err);  // New: For debugging
        alert('Payment error: ' + err.message);
        submitBtn.disabled = false;
        loading.style.display = 'none';
        return;
      }
    }

    // Submit order (Your original, with redirect)
    try {
      const res = await fetch('/api/orders', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Order submission failed');
      const result = await res.json();

      // New: Redirect to thank you page with details
      const orderDetails = encodeURIComponent(JSON.stringify({
        medicines: medicines,
        payment: paymentMethodSelect.value,
        total: medicines.reduce((sum, m) => sum + (m.quantity * 10), 0)
      }));
      window.location.href = `thankyou.html?details=${orderDetails}`;
    } catch (err) {
      console.error('Order submission error:', err);  // New: For debugging
      alert('Order submission failed: ' + err.message);
    } finally {
      // Hide loading (New)
      submitBtn.disabled = false;
      loading.style.display = 'none';
    }
  });
}

// Initial summary update on page load (New)
if (orderSummary) updateSummary();
