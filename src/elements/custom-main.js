/**
 * Variant change listener to update pattern product checkbox
 * Listens for variant changes and updates the checkbox's data-current-variant-title
 */
class VariantChangeListener extends HTMLElement {
  constructor() {
    super();
    this.variantChangeUnsubscriber = null;
    this.optionChangeUnsubscriber = null;
  }

  connectedCallback() {
    this.setupVariantChangeListener();
  }

  disconnectedCallback() {
    if (this.variantChangeUnsubscriber) {
      this.variantChangeUnsubscriber();
      this.variantChangeUnsubscriber = null;
    }
    if (this.optionChangeUnsubscriber) {
      this.optionChangeUnsubscriber();
      this.optionChangeUnsubscriber = null;
    }
  }

  setupVariantChangeListener() {
    // Subscribe to variant change events
    if (window.theme?.PUB_SUB_EVENTS?.variantChange && window.subscribe) {
      this.variantChangeUnsubscriber = window.subscribe(
        window.theme.PUB_SUB_EVENTS.variantChange,
        this.handleVariantChange.bind(this)
      );
    }

    // Listen to option value changes to catch variant updates
    if (
      window.theme?.PUB_SUB_EVENTS?.optionValueSelectionChange &&
      window.subscribe
    ) {
      this.optionChangeUnsubscriber = window.subscribe(
        window.theme.PUB_SUB_EVENTS.optionValueSelectionChange,
        () => {
          // Wait a bit for the DOM to update with new variant data
          setTimeout(() => this.updateVariantTitle(), 200);
        }
      );
    }

    // Initial update
    setTimeout(() => this.updateVariantTitle(), 100);
  }

  handleVariantChange(event) {
    if (event?.detail?.variant) {
      this.updateVariantTitleFromVariant(event.detail.variant);
    } else {
      this.updateVariantTitle();
    }
  }

  updateVariantTitle() {
    // Find the data-selected-variant script tag in variant-selects or product-form
    const variantSelects = document.querySelector("variant-selects");
    let variantScript = null;

    if (variantSelects) {
      variantScript = variantSelects.querySelector("[data-selected-variant]");
    }

    if (!variantScript) {
      // Try to find it in product-form
      const productForm = document.querySelector("product-form");
      if (productForm) {
        variantScript = productForm.querySelector("[data-selected-variant]");
      }
    }

    if (variantScript) {
      this.parseAndUpdateVariant(variantScript);
    }
  }

  parseAndUpdateVariant(variantScript) {
    try {
      const variantData = JSON.parse(variantScript.textContent);
      if (variantData && variantData.title) {
        this.updateVariantTitleFromVariant(variantData);
      }
    } catch (e) {
      console.warn("Failed to parse variant data:", e);
    }
  }

  updateVariantTitleFromVariant(variant) {
    const variantTitle = variant.title || "";
    const checkbox = document.querySelector("#pattern_product");

    if (checkbox) {
      checkbox.setAttribute("data-current-variant-title", variantTitle);

      // Update the count display when variant changes
      this.updatePatternProductCount(checkbox);

      // Trigger checkbox change if it's checked to recalculate price
      if (checkbox.checked) {
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  /**
   * Update pattern product count display based on current variant
   * @param {HTMLElement} checkbox - The pattern product checkbox
   */
  updatePatternProductCount(checkbox) {
    const currentVariantTitle = checkbox.dataset.currentVariantTitle || "";
    const sizeCountData =
      checkbox.dataset.parrentProductCountForVariant || "{}";

    let countValue = 1;

    try {
      const sizeCountObject = JSON.parse(sizeCountData);
      if (
        sizeCountObject &&
        currentVariantTitle &&
        sizeCountObject[currentVariantTitle]
      ) {
        countValue = parseInt(sizeCountObject[currentVariantTitle], 10) || 1;
      }
    } catch (e) {
      console.warn("Failed to parse size count data:", e);
    }

    // Update the count display
    const countSpan = document.querySelector("[data-pattern-product-count]");
    if (countSpan) {
      countSpan.textContent = countValue;
    }
  }
}

/**
 * Custom checkbox change listener for product forms
 * Handles pattern product checkbox and other checkbox interactions
 */
class PatternProductForm extends HTMLElement {
  constructor() {
    super();
    this.checkboxes = new Map();
    this.patternProductCheckbox = null;
  }

  connectedCallback() {
    this.init();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  /**
   * Initialize checkbox listeners
   */
  init() {
    // Find pattern product checkbox
    this.patternProductCheckbox = this.querySelector("#pattern_product");

    if (this.patternProductCheckbox) {
      this.setupPatternProductCheckbox();
      // Update count on initial load based on current variant
      this.updateInitialCount();
    }

    // Setup generic checkbox listeners for all checkboxes in the form
    this.setupGenericCheckboxListeners();

    // Setup form submit override
    this.setupFormSubmit();
  }

  /**
   * Setup form submit override
   */
  setupFormSubmit() {
    // Find the form - it might be a parent or sibling element
    const form =
      this.closest("form") ||
      document.querySelector(`form[action*="/cart/add"]`);

    if (!form) return;

    // Store form reference
    this.form = form;

    // Bind and store the handler so we can remove it later
    this.boundHandleFormSubmit = this.handleFormSubmit.bind(this);

    // Override form submit - use capture phase to run before other handlers
    form.addEventListener("submit", this.boundHandleFormSubmit, true);
  }

  /**
   * Handle form submit with custom API call
   * @param {Event} event - The submit event
   */
  handleFormSubmit(event) {
    // Only use custom API if pattern product checkbox is checked
    if (!this.patternProductCheckbox || !this.patternProductCheckbox.checked) {
      // Let form submit normally
      return;
    }

    // Prevent default form submission and stop propagation
    // This prevents other handlers (like ProductForm) from running
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const form = event.target;
    const submitButton = form.querySelector('[type="submit"]');

    // Disable submit button to prevent double submission
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("loading");
    }

    // Get section-id from hidden input
    const sectionIdInput = form.querySelector('input[name="section-id"]');
    const sectionId = sectionIdInput ? sectionIdInput.value : null;

    // Get main product variant ID and quantity
    const variantIdInput = form.querySelector('input[name="id"]');
    const quantityInput = form.querySelector('input[name="quantity"]');

    if (!variantIdInput) {
      console.error("Variant ID not found");
      this.enableSubmitButton(submitButton);
      return;
    }

    const variantId = parseInt(variantIdInput.value, 10);
    const quantity = quantityInput ? parseInt(quantityInput.value, 10) || 1 : 1;

    // Build items array
    const items = [
      {
        id: variantId,
        quantity: quantity,
      },
    ];

    // Add pattern product if checkbox is checked
    if (this.patternProductCheckbox && this.patternProductCheckbox.checked) {
      // Get variant ID directly from data attribute (preferred)
      const patternVariantId =
        this.patternProductCheckbox.dataset.patternProductVariantId;
      const currentVariantTitle =
        this.patternProductCheckbox.dataset.currentVariantTitle || "";
      const sizeCountData =
        this.patternProductCheckbox.dataset.parrentProductCountForVariant ||
        "{}";

      let patternQuantity = 1;

      // Calculate pattern product quantity based on variant
      try {
        const sizeCountObject = JSON.parse(sizeCountData);
        if (
          sizeCountObject &&
          currentVariantTitle &&
          sizeCountObject[currentVariantTitle]
        ) {
          patternQuantity =
            parseInt(sizeCountObject[currentVariantTitle], 10) || 1;
        }
      } catch (e) {
        console.warn("Failed to parse size count data:", e);
      }

      if (patternVariantId) {
        const variantId = parseInt(patternVariantId, 10);

        if (isNaN(variantId)) {
          console.error(
            "Invalid pattern product variant ID:",
            patternVariantId
          );
          this.enableSubmitButton(submitButton);
          this.handleAddToCartError(
            new Error(
              "Pattern product variant not available. Please try again."
            )
          );
          return;
        }

        items.push({
          id: variantId,
          quantity: patternQuantity,
        });
      } else {
        console.error("Pattern product variant ID not found");
        this.enableSubmitButton(submitButton);
        this.handleAddToCartError(
          new Error("Pattern product variant not available. Please try again.")
        );
        return;
      }
    }

    // Validate items array
    if (!items || items.length === 0) {
      console.error("No items to add to cart");
      this.enableSubmitButton(submitButton);
      return;
    }

    // Validate that all IDs are numbers
    const invalidItems = items.filter(
      (item) => !item.id || isNaN(item.id) || item.quantity <= 0
    );
    if (invalidItems.length > 0) {
      console.error("Invalid items:", invalidItems);
      this.enableSubmitButton(submitButton);
      return;
    }

    // Prepare form data according to Shopify Cart API
    const formData = {
      items: items,
    };

    // Add sections if needed
    if (sectionId) {
      formData.sections_url = `/cart?section_id=cart-drawer&section_id=${encodeURIComponent(sectionId)}`;
    } else {
      formData.sections_url = "/cart?section_id=cart-drawer";
    }

    // Make API call
    const rootUrl =
      window.theme?.routes?.root || window.theme?.routes?.shop_url || "/";
    // Ensure rootUrl ends with / if it doesn't already
    const normalizedRoot = rootUrl.endsWith("/") ? rootUrl : `${rootUrl}/`;
    const addToCartUrl = `${normalizedRoot}cart/add.js`;

    fetch(addToCartUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => {
        // Parse response as JSON first to get error details
        return response.json().then((data) => {
          if (!response.ok) {
            // Shopify returns error details in the response
            const errorMessage =
              data.description ||
              data.message ||
              data.error ||
              "Failed to add to cart";
            const error = new Error(errorMessage);
            error.response = data;
            error.status = response.status;
            throw error;
          }
          return data;
        });
      })
      .then((data) => {
        // Handle successful response
        this.handleAddToCartSuccess(data, formData);
      })
      .catch((error) => {
        console.error("Error adding to cart:", error);
        this.handleAddToCartError(error);
      })
      .finally(() => {
        this.enableSubmitButton(submitButton);
      });
  }

  /**
   * Handle successful add to cart
   * @param {Object} data - Response data
   * @param {Object} formData - Original form data
   */
  handleAddToCartSuccess(data, formData) {
    // Find cart-element - the theme uses 'cart-element' custom element
    // It can be a cart drawer (with data-cart-drawer attribute) or cart page (with data-cart-page)
    // See theme.dev.js line 2519-2520 for the custom element definition
    const cartElement = document.querySelector("cart-element");

    if (cartElement && typeof cartElement.getCart === "function") {
      // Use the theme's getCart method (defined at line 2867 in theme.dev.js)
      // This will:
      // 1. Fetch cart data from theme.routes.cart_url + '?section_id=api-cart-items'
      // 2. Call build() method (line 3712) to update the cart HTML
      // 3. The build() method automatically calls openCartDrawer() if it's a cart drawer (line 3819)
      cartElement.getCart();
    } else {
      // Fallback: dispatch event to trigger cart refresh
      // The cart-element listens to 'theme:cart:refresh' event (line 2603 in theme.dev.js)
      document.dispatchEvent(
        new CustomEvent("theme:cart:refresh", { bubbles: true })
      );

      // Also try to manually update sections if provided
      if (data.sections) {
        this.updateCartSections(data.sections);
      } else if (formData.sections_url) {
        this.fetchCartSections(formData.sections_url);
      }
    }

    // Dispatch custom event - cart-element listens to this (line 2586 in theme.dev.js)
    // The cartAddEvent method (line 2819) handles this event
    // However, since we're using custom API, we don't need to trigger the default addToCart flow
    // The getCart() call above will refresh the cart with the new items
    document.dispatchEvent(
      new CustomEvent("theme:cart:add", {
        detail: {
          items: data.items || [],
          cart: data,
        },
        bubbles: true,
      })
    );
  }

  /**
   * Handle add to cart error
   * @param {Error} error - Error object
   */
  handleAddToCartError(error) {
    // Show error message
    const errorContainer = this.form?.querySelector(
      "[data-cart-errors-container]"
    );
    if (errorContainer) {
      errorContainer.textContent =
        error.message || "Failed to add product to cart";
      errorContainer.setAttribute("role", "alert");
      errorContainer.classList.remove("hidden");
    }

    // Dispatch error event
    document.dispatchEvent(
      new CustomEvent("theme:cart:add:error", {
        detail: { error },
        bubbles: true,
      })
    );
  }

  /**
   * Update cart sections in DOM
   * @param {Object} sections - Sections data from response
   */
  updateCartSections(sections) {
    // Update cart drawer
    if (sections["cart-drawer"]) {
      const cartDrawer = document.querySelector("cart-drawer");
      if (cartDrawer) {
        cartDrawer.innerHTML = sections["cart-drawer"];
      }
    }

    // Update cart icon bubble
    if (sections["cart-icon-bubble"]) {
      const cartIconBubble = document.querySelector("[data-cart-icon-bubble]");
      if (cartIconBubble) {
        cartIconBubble.outerHTML = sections["cart-icon-bubble"];
      }
    }
  }

  /**
   * Fetch cart sections from URL
   * @param {String} url - Sections URL
   */
  fetchCartSections(url) {
    fetch(url)
      .then((response) => response.text())
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        // Update cart drawer
        const cartDrawerContent = doc.querySelector("cart-drawer");
        if (cartDrawerContent) {
          const cartDrawer = document.querySelector("cart-drawer");
          if (cartDrawer) {
            cartDrawer.innerHTML = cartDrawerContent.innerHTML;
          }
        }

        // Update cart icon bubble
        const cartIconBubbleContent = doc.querySelector(
          "[data-cart-icon-bubble]"
        );
        if (cartIconBubbleContent) {
          const cartIconBubble = document.querySelector(
            "[data-cart-icon-bubble]"
          );
          if (cartIconBubble) {
            cartIconBubble.outerHTML = cartIconBubbleContent.outerHTML;
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching cart sections:", error);
      });
  }

  /**
   * Enable submit button
   * @param {HTMLElement} submitButton - Submit button element
   */
  enableSubmitButton(submitButton) {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove("loading");
    }
  }

  /**
   * Update count display on initial load
   */
  updateInitialCount() {
    const checkbox = this.patternProductCheckbox;
    if (!checkbox) return;

    const currentVariantTitle = checkbox.dataset.currentVariantTitle || "";
    const sizeCountData =
      checkbox.dataset.parrentProductCountForVariant || "{}";

    let countValue = 1;

    try {
      const sizeCountObject = JSON.parse(sizeCountData);
      if (
        sizeCountObject &&
        currentVariantTitle &&
        sizeCountObject[currentVariantTitle]
      ) {
        countValue = parseInt(sizeCountObject[currentVariantTitle], 10) || 1;
      }
    } catch (e) {
      console.warn("Failed to parse size count data:", e);
    }

    // Update the count display
    const countSpan = this.querySelector("[data-pattern-product-count]");
    if (countSpan) {
      countSpan.textContent = countValue;
    }
  }

  /**
   * Setup specific listener for pattern product checkbox
   */
  setupPatternProductCheckbox() {
    this.patternProductCheckbox.addEventListener("change", (event) => {
      this.handlePatternProductChange(event);
    });

    // Store reference
    this.checkboxes.set("pattern_product", this.patternProductCheckbox);
  }

  /**
   * Handle pattern product checkbox change
   * @param {Event} event - The change event
   */
  handlePatternProductChange(event) {
    const checkbox = event.target;
    const isChecked = checkbox.checked;

    // Get data attributes
    const mainProductPrice = parseFloat(checkbox.dataset.mainProductPrice || 0);
    const patternProductPrice = parseFloat(
      checkbox.dataset.patternProductPrice || 0
    );
    const patternProductId = checkbox.dataset.patternProductId;
    const formattedPrice = checkbox.dataset.patternProductFormattedPrice || "";

    // Get current variant title and count multiplier
    const currentVariantTitle = checkbox.dataset.currentVariantTitle || "";
    const sizeCountData =
      checkbox.dataset.parrentProductCountForVariant || "{}";

    let countMultiplier = 1;

    try {
      const sizeCountObject = JSON.parse(sizeCountData);
      if (
        sizeCountObject &&
        currentVariantTitle &&
        sizeCountObject[currentVariantTitle]
      ) {
        countMultiplier =
          parseInt(sizeCountObject[currentVariantTitle], 10) || 1;
      }
    } catch (e) {
      console.warn("Failed to parse size count data:", e);
    }

    // Calculate total price with multiplier
    const adjustedPatternPrice = patternProductPrice * countMultiplier;
    const totalPrice = isChecked
      ? mainProductPrice + adjustedPatternPrice
      : mainProductPrice;

    // Dispatch custom event for other components to listen to
    this.dispatchPatternProductChangeEvent({
      isChecked,
      mainProductPrice,
      patternProductPrice: adjustedPatternPrice,
      patternProductPriceBase: patternProductPrice,
      countMultiplier,
      totalPrice,
      patternProductId,
      formattedPrice,
      currentVariantTitle,
    });

    // Update price display if price element exists
    this.updatePriceDisplay(totalPrice, isChecked, formattedPrice);

    // Update form data or cart data if needed
    this.updateFormData(isChecked, patternProductId);
  }

  /**
   * Dispatch custom event for pattern product change
   * @param {Object} data - Event data
   */
  dispatchPatternProductChangeEvent(data) {
    const event = new CustomEvent("product:pattern:change", {
      detail: data,
      bubbles: true,
      cancelable: true,
    });
    this.dispatchEvent(event);
    document.dispatchEvent(event);
  }

  /**
   * Update price display in the UI
   * @param {Number} totalPrice - Total price in cents
   * @param {Boolean} isChecked - Whether checkbox is checked
   * @param {String} formattedPrice - Formatted price string
   */
  updatePriceDisplay(totalPrice, isChecked, formattedPrice) {
    // Find price elements - adjust selectors based on your theme structure
    const priceElements = document.querySelectorAll(
      "[data-add-to-cart] [data-product-price]"
    );

    if (priceElements.length > 0) {
      // Format price (assuming price is in cents)
      const formattedTotal = this.formatPrice(totalPrice);

      priceElements.forEach((element) => {
        // Update price text
        const priceText = element.querySelector(
          ".price__regular, .price__current, [data-price]"
        );
        if (priceText) {
          priceText.textContent = formattedTotal;
        } else if (element.textContent) {
          element.textContent = formattedTotal;
        }

        // Add/remove class to indicate pattern product is included
        if (isChecked) {
          element.classList.add("price--with-pattern-product");
        } else {
          element.classList.remove("price--with-pattern-product");
        }
      });
    }
  }

  /**
   * Format price from cents to currency string
   * @param {Number} priceInCents - Price in cents
   * @returns {String} Formatted price
   */
  formatPrice(priceInCents) {
    // Use Shopify's formatMoney function if available
    if (window.theme && window.theme.formatMoney) {
      return window.theme.formatMoney(priceInCents, window.theme?.moneyFormat);
    }
  }

  /**
   * Update form data when pattern product is selected
   * @param {Boolean} isChecked - Whether checkbox is checked
   * @param {String} patternProductId - Pattern product ID
   */
  updateFormData(isChecked, patternProductId) {
    const form =
      this.closest("form") ||
      document.querySelector(`form[action*="/cart/add"]`);

    if (!form) return;

    // Add or remove hidden input for pattern product
    let patternInput = form.querySelector('[name="pattern_product_id"]');

    if (isChecked && patternProductId) {
      if (!patternInput) {
        patternInput = document.createElement("input");
        patternInput.type = "hidden";
        patternInput.name = "pattern_product_id";
        form.appendChild(patternInput);
      }
      patternInput.value = patternProductId;
    } else if (patternInput) {
      patternInput.remove();
    }
  }

  /**
   * Setup generic listeners for all checkboxes in the form
   */
  setupGenericCheckboxListeners() {
    const allCheckboxes = this.querySelectorAll('input[type="checkbox"]');

    allCheckboxes.forEach((checkbox) => {
      // Skip if already handled
      if (checkbox.id === "pattern_product") return;

      checkbox.addEventListener("change", (event) => {
        this.handleGenericCheckboxChange(event);
      });

      // Store reference
      const name =
        checkbox.name || checkbox.id || `checkbox-${this.checkboxes.size}`;
      this.checkboxes.set(name, checkbox);
    });
  }

  /**
   * Handle generic checkbox change events
   * @param {Event} event - The change event
   */
  handleGenericCheckboxChange(event) {
    const checkbox = event.target;
    const isChecked = checkbox.checked;
    const name = checkbox.name || checkbox.id;

    // Dispatch generic checkbox change event
    const changeEvent = new CustomEvent("product:checkbox:change", {
      detail: {
        name,
        isChecked,
        value: checkbox.value,
        checkbox,
      },
      bubbles: true,
      cancelable: true,
    });

    this.dispatchEvent(changeEvent);
    document.dispatchEvent(changeEvent);
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    // Remove form submit listener
    if (this.form && this.boundHandleFormSubmit) {
      this.form.removeEventListener("submit", this.boundHandleFormSubmit);
    }

    this.checkboxes.forEach((checkbox) => {
      // Clone and replace to remove all event listeners
      const newCheckbox = checkbox.cloneNode(true);
      checkbox.parentNode?.replaceChild(newCheckbox, checkbox);
    });

    this.checkboxes.clear();
    this.patternProductCheckbox = null;
    this.form = null;
    this.boundHandleFormSubmit = null;
  }

  /**
   * Get checkbox state
   * @param {String} name - Checkbox name or id
   * @returns {Boolean|null} Checkbox checked state or null if not found
   */
  getCheckboxState(name) {
    const checkbox =
      this.checkboxes.get(name) ||
      this.querySelector(`#${name}, [name="${name}"]`);
    return checkbox ? checkbox.checked : null;
  }

  /**
   * Set checkbox state
   * @param {String} name - Checkbox name or id
   * @param {Boolean} checked - Whether to check or uncheck
   */
  setCheckboxState(name, checked) {
    const checkbox =
      this.checkboxes.get(name) ||
      this.querySelector(`#${name}, [name="${name}"]`);
    if (checkbox) {
      checkbox.checked = checked;
      // Trigger change event
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}

// Register custom elements
if (!customElements.get("product-form-checkboxes")) {
  customElements.define("product-form-checkboxes", PatternProductForm);
}

if (!customElements.get("variant-change-listener")) {
  customElements.define("variant-change-listener", VariantChangeListener);
}

// Extend VariantSelects class
function extendVariantSelectsClass() {
  // Wait for VariantSelects to be defined
  const checkInterval = setInterval(() => {
    const VariantSelectsBase = customElements.get("variant-selects");
    if (VariantSelectsBase) {
      clearInterval(checkInterval);

      // Get the original prototype
      const originalConnectedCallback =
        VariantSelectsBase.prototype.connectedCallback;
      const originalDisconnectedCallback =
        VariantSelectsBase.prototype.disconnectedCallback;

      // Extend connectedCallback
      VariantSelectsBase.prototype.connectedCallback = function () {
        // Call original
        if (originalConnectedCallback) {
          originalConnectedCallback.call(this);
        }

        // Add our functionality
        this.setupVariantTitleUpdate();
      };

      // Extend disconnectedCallback
      VariantSelectsBase.prototype.disconnectedCallback = function () {
        // Cleanup our listeners
        if (this.variantTitleUpdateUnsubscriber) {
          this.variantTitleUpdateUnsubscriber();
          this.variantTitleUpdateUnsubscriber = null;
        }
        if (this.optionChangeUnsubscriber) {
          this.optionChangeUnsubscriber();
          this.optionChangeUnsubscriber = null;
        }

        // Call original
        if (originalDisconnectedCallback) {
          originalDisconnectedCallback.call(this);
        }
      };

      // Add method to setup variant title update
      VariantSelectsBase.prototype.setupVariantTitleUpdate = function () {
        // Listen to option value changes to catch variant updates
        if (
          window.theme?.PUB_SUB_EVENTS?.optionValueSelectionChange &&
          window.subscribe
        ) {
          this.optionChangeUnsubscriber = window.subscribe(
            window.theme.PUB_SUB_EVENTS.optionValueSelectionChange,
            () => {
              // Wait a bit for the DOM to update with new variant data
              setTimeout(() => this.updateVariantTitle(), 200);
            }
          );
        }

        // Initial update
        setTimeout(() => this.updateVariantTitle(), 100);
      };

      // Add method to update variant title
      VariantSelectsBase.prototype.updateVariantTitle = function () {
        const variantScript = this.querySelector("[data-selected-variant]");
        if (!variantScript) return;

        try {
          const variantData = JSON.parse(variantScript.textContent);
          if (variantData && variantData.title) {
            const variantTitle = variantData.title || "";
            const checkbox = document.querySelector("#pattern_product");

            if (checkbox) {
              checkbox.setAttribute("data-current-variant-title", variantTitle);

              // Update the count display when variant changes
              this.updatePatternProductCount(checkbox);

              // Trigger checkbox change if it's checked to recalculate price
              if (checkbox.checked) {
                checkbox.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }
        } catch (e) {
          console.warn("Failed to parse variant data:", e);
        }
      };

      // Add method to update pattern product count
      VariantSelectsBase.prototype.updatePatternProductCount = function (
        checkbox
      ) {
        const currentVariantTitle = checkbox.dataset.currentVariantTitle || "";
        const sizeCountData =
          checkbox.dataset.parrentProductCountForVariant || "{}";

        let countValue = 1;

        try {
          const sizeCountObject = JSON.parse(sizeCountData);
          if (
            sizeCountObject &&
            currentVariantTitle &&
            sizeCountObject[currentVariantTitle]
          ) {
            countValue =
              parseInt(sizeCountObject[currentVariantTitle], 10) || 1;
          }
        } catch (e) {
          console.warn("Failed to parse size count data:", e);
        }

        // Update the count display
        const countSpan = document.querySelector(
          "[data-pattern-product-count]"
        );
        if (countSpan) {
          countSpan.textContent = countValue;
        }
      };
    }
  }, 100);

  // Stop checking after 5 seconds
  setTimeout(() => clearInterval(checkInterval), 5000);
}

// Initialize extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", extendVariantSelectsClass);
} else {
  extendVariantSelectsClass();
}

// Export for use in other modules
if (typeof window !== "undefined") {
  window.PatternProductForm = PatternProductForm;
  window.VariantChangeListener = VariantChangeListener;
}
