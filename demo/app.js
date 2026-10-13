// Cart counter for the demo storefront. Purely cosmetic: there is no checkout.
(function () {
  var KEY = 'marlow_cart_count';
  var label = document.getElementById('cart-count');

  function read() {
    try {
      return Number(window.localStorage.getItem(KEY)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function write(n) {
    try {
      window.localStorage.setItem(KEY, String(n));
    } catch (e) {
      /* storage blocked */
    }
  }

  function render(n) {
    if (label) label.textContent = String(n);
  }

  render(read());

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-add-to-cart]') : null;
    if (!button) return;
    var next = read() + 1;
    write(next);
    render(next);
  });
})();
