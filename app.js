const products = [
  {
    id: "everlane-box-cut-tee-black",
    brand: "Everlane",
    title: "Organic Cotton Box-Cut Tee",
    category: "T-Shirts",
    color: "Black",
    fit: "Relaxed",
    material: "100% organic cotton",
    description:
      "A clean everyday tee with a heavier hand feel, relaxed shoulder, and easy price comparison across basics-focused stores.",
    image: "public/product-images/box-cut-tee.png",
    tags: ["organic", "basic", "heavyweight"],
    offers: [
      offer("Everlane", 18, 30, "$7 or free over $75", ["XS", "S", "M", "L", "XL"], "https://www.everlane.com", 2),
      offer("Nordstrom", 22, 30, "Free over $89", ["S", "M", "L"], "https://www.nordstrom.com", 5)
    ]
  },
  {
    id: "uniqlo-airism-tee-white",
    brand: "Uniqlo",
    title: "AIRism Cotton Oversized Tee",
    category: "T-Shirts",
    color: "White",
    fit: "Oversized",
    material: "Cotton-poly blend",
    description:
      "A smooth oversized tee with a structured drape, strong value, and broad size availability for everyday rotation.",
    image: "public/product-images/airism-tee.png",
    tags: ["oversized", "smooth", "value"],
    offers: [
      offer("Uniqlo", 14.9, 24.9, "$7.99 or free promos", ["XS", "S", "M", "L", "XL", "XXL"], "https://www.uniqlo.com", 1)
    ]
  },
  {
    id: "jcrew-garment-dyed-tee-navy",
    brand: "J.Crew",
    title: "Garment-Dyed Slub Cotton Tee",
    category: "T-Shirts",
    color: "Navy",
    fit: "Regular",
    material: "Slub cotton",
    description:
      "Soft slub texture with a worn-in finish and frequent markdowns, useful for shoppers who want polished basics under budget.",
    image: "public/product-images/slub-tee.png",
    tags: ["slub", "classic", "soft"],
    offers: [
      offer("J.Crew", 19.5, 39.5, "$5 or free over $99", ["S", "M", "L", "XL"], "https://www.jcrew.com", 4),
      offer("Amazon", 26, 39.5, "Prime eligible", ["M", "L", "XL"], "https://www.amazon.com", 12)
    ]
  },
  {
    id: "abercrombie-premium-heavyweight-gray",
    brand: "Abercrombie",
    title: "Premium Heavyweight Tee",
    category: "T-Shirts",
    color: "Heather Gray",
    fit: "Regular",
    material: "Heavyweight cotton jersey",
    description:
      "A dense tee with a clean collar and structured body, ranked well for shoppers who prefer sturdier basics.",
    image: "public/product-images/heavyweight-tee.png",
    tags: ["heavyweight", "structured", "plain"],
    offers: [
      offer("Abercrombie", 24, 40, "$7 or free over $99", ["S", "M", "L", "XL"], "https://www.abercrombie.com", 3)
    ]
  },
  {
    id: "gap-vintage-soft-long-sleeve-olive",
    brand: "Gap",
    title: "VintageSoft Long Sleeve Tee",
    category: "Long Sleeves",
    color: "Olive",
    fit: "Relaxed",
    material: "Soft cotton blend",
    description:
      "A relaxed long sleeve with an easy layerable fit, often available in multiple colors and promo pricing.",
    image: "public/product-images/long-sleeve.png",
    tags: ["long sleeve", "soft", "layering"],
    offers: [
      offer("Gap", 16, 34.95, "$7 or free over $50", ["XS", "S", "M", "L"], "https://www.gap.com", 6)
    ]
  },
  {
    id: "nike-club-fleece-hoodie-black",
    brand: "Nike",
    title: "Club Fleece Pullover Hoodie",
    category: "Hoodies",
    color: "Black",
    fit: "Regular",
    material: "Cotton-poly fleece",
    description:
      "A reliable fleece hoodie with recurring sale prices and useful size coverage across major retailers.",
    image: "public/product-images/club-hoodie.png",
    tags: ["fleece", "hoodie", "athletic"],
    offers: [
      offer("Nike", 48, 65, "Free for members", ["S", "M", "L", "XL", "XXL"], "https://www.nike.com", 8),
      offer("Dick's Sporting Goods", 44.97, 65, "Free over $49", ["M", "L", "XL"], "https://www.dickssportinggoods.com", 10)
    ]
  },
  {
    id: "madewell-softfade-sweatshirt-blue",
    brand: "Madewell",
    title: "Softfade Crewneck Sweatshirt",
    category: "Sweatshirts",
    color: "Washed Blue",
    fit: "Relaxed",
    material: "Cotton fleece",
    description:
      "A washed crewneck with a lived-in finish and softer casual profile for shoppers who like muted colors.",
    image: "public/product-images/softfade-sweatshirt.png",
    tags: ["crewneck", "washed", "soft"],
    offers: [
      offer("Madewell", 39.99, 78, "$7 or free over $75", ["XS", "S", "M", "L"], "https://www.madewell.com", 9)
    ]
  },
  {
    id: "carhartt-pocket-tee-brown",
    brand: "Carhartt",
    title: "Loose Fit Heavyweight Pocket Tee",
    category: "T-Shirts",
    color: "Brown",
    fit: "Relaxed",
    material: "Heavyweight cotton",
    description:
      "A durable pocket tee with a roomier cut, strong availability, and reliable value for workwear-influenced outfits.",
    image: "public/product-images/pocket-tee.png",
    tags: ["workwear", "pocket", "heavyweight"],
    offers: [
      offer("Carhartt", 19.99, 24.99, "$7.95 or free promos", ["S", "M", "L", "XL", "XXL"], "https://www.carhartt.com", 7),
      offer("Amazon", 17.99, 24.99, "Prime eligible", ["M", "L", "XL"], "https://www.amazon.com", 11)
    ]
  }
];

const defaultPreferences = {
  sizes: ["M", "L"],
  favoriteBrands: ["Everlane", "Uniqlo"],
  dislikedBrands: [],
  colors: ["Black", "White", "Navy"],
  fits: ["Regular", "Relaxed"],
  categories: ["T-Shirts", "Long Sleeves"],
  minPrice: 10,
  maxPrice: 80,
  minDiscount: 15
};

const state = {
  query: "",
  category: "all",
  brand: "all",
  color: "all",
  size: "all",
  maxPrice: 80,
  minDiscount: 0,
  sort: "best-match"
};

const app = document.querySelector("#app");

function offer(store, currentPrice, originalPrice, shipping, availableSizes, url, updatedHoursAgo) {
  return {
    id: `${store}-${currentPrice}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    store,
    currentPrice,
    originalPrice,
    currency: "USD",
    shipping,
    availableSizes,
    url,
    updatedHoursAgo,
    inStock: true
  };
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

function unique(values) {
  return [...new Set(values)].sort();
}

function facets() {
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
  return {
    brands: unique(products.map((product) => product.brand)),
    categories: unique(products.map((product) => product.category)),
    colors: unique(products.map((product) => product.color)),
    fits: unique(products.map((product) => product.fit)),
    sizes: unique(products.flatMap((product) => product.offers.flatMap((offerItem) => offerItem.availableSizes))).sort(
      (a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)
    )
  };
}

function bestOffer(product) {
  return [...product.offers].filter((item) => item.inStock).sort((a, b) => a.currentPrice - b.currentPrice)[0];
}

function discount(product) {
  const best = bestOffer(product);
  if (!best || best.originalPrice <= best.currentPrice) return 0;
  return Math.round(((best.originalPrice - best.currentPrice) / best.originalPrice) * 100);
}

function freshness(product) {
  const best = bestOffer(product);
  return best.updatedHoursAgo < 1 ? "Updated now" : `Updated ${best.updatedHoursAgo}h ago`;
}

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem("threadscout.saved") || "[]");
  } catch {
    return [];
  }
}

function writeSaved(saved) {
  localStorage.setItem("threadscout.saved", JSON.stringify([...new Set(saved)]));
}

function readPreferences() {
  try {
    return {
      ...defaultPreferences,
      ...JSON.parse(localStorage.getItem("threadscout.preferences") || "{}")
    };
  } catch {
    return { ...defaultPreferences };
  }
}

function writePreferences(preferences) {
  localStorage.setItem("threadscout.preferences", JSON.stringify(preferences));
}

function scoreProduct(product, preferences = readPreferences()) {
  const best = bestOffer(product);
  let score = 0;

  if (!best) return -100;
  if (preferences.favoriteBrands.includes(product.brand)) score += 28;
  if (preferences.dislikedBrands.includes(product.brand)) score -= 60;
  if (preferences.colors.includes(product.color)) score += 16;
  if (preferences.fits.includes(product.fit)) score += 16;
  if (preferences.categories.includes(product.category)) score += 12;
  if (preferences.sizes.some((size) => best.availableSizes.includes(size))) score += 22;
  if (best.currentPrice >= preferences.minPrice && best.currentPrice <= preferences.maxPrice) score += 18;
  if (discount(product) >= preferences.minDiscount) score += 16;
  if (best.updatedHoursAgo <= 4) score += 8;

  score += product.offers.length * 4;
  score -= Math.max(0, best.currentPrice - preferences.maxPrice) * 0.5;

  return Math.max(0, Math.min(99, Math.round(score)));
}

function filteredProducts() {
  const query = state.query.trim().toLowerCase();
  const preferences = readPreferences();

  return products
    .filter((product) => {
      const best = bestOffer(product);
      const searchable = [
        product.brand,
        product.title,
        product.category,
        product.color,
        product.fit,
        product.material,
        ...product.tags
      ]
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (state.category !== "all" && product.category !== state.category) return false;
      if (state.brand !== "all" && product.brand !== state.brand) return false;
      if (state.color !== "all" && product.color !== state.color) return false;
      if (state.size !== "all" && !best.availableSizes.includes(state.size)) return false;
      if (best.currentPrice > Number(state.maxPrice)) return false;
      if (discount(product) < Number(state.minDiscount)) return false;
      return true;
    })
    .sort((a, b) => {
      if (state.sort === "lowest-price") return bestOffer(a).currentPrice - bestOffer(b).currentPrice;
      if (state.sort === "biggest-discount") return discount(b) - discount(a);
      if (state.sort === "recently-updated") return bestOffer(a).updatedHoursAgo - bestOffer(b).updatedHoursAgo;
      return scoreProduct(b, preferences) - scoreProduct(a, preferences);
    });
}

function html(strings, ...values) {
  return strings.reduce((result, string, index) => result + string + (values[index] ?? ""), "");
}

function setActiveNav(route) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === route);
  });
}

function render() {
  const hash = window.location.hash || "#/";
  const productMatch = hash.match(/^#\/products\/(.+)$/);

  if (productMatch) {
    renderProduct(productMatch[1]);
    return;
  }

  if (hash === "#/saved") {
    setActiveNav("saved");
    renderSaved();
    return;
  }

  if (hash === "#/preferences") {
    setActiveNav("preferences");
    renderPreferences();
    return;
  }

  setActiveNav("search");
  renderSearch();
}

function renderSearch() {
  const catalogFacets = facets();
  app.innerHTML = html`
    <section class="search-hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div>
          <p class="eyebrow">MVP apparel deal search</p>
          <h1 id="hero-title">Find the shirt before the markup wins.</h1>
          <p>
            Search T-shirts, hoodies, sweatshirts, and long sleeves, then compare the best offers
            by size, discount, store, and freshness.
          </p>
          <form class="searchbar" id="search-form">
            <input
              type="search"
              id="query"
              value="${state.query}"
              placeholder="Search black heavyweight tee, oversized white, Nike hoodie..."
              aria-label="Search clothing"
            />
            <button class="primary-button" type="submit">Search</button>
          </form>
        </div>
        <div class="chip-row" aria-label="Popular categories">
          ${["T-Shirts", "Hoodies", "Sweatshirts", "Long Sleeves"]
            .map((item) => `<button class="chip quick-category" type="button" data-category="${item}">${item}</button>`)
            .join("")}
        </div>
      </div>
      <figure class="hero-media">
        <img src="public/product-images/hero-rack.png" alt="Organized rack of neutral T-shirts and casual layers" />
        <figcaption>${products.length} seeded products with normalized offers and freshness labels.</figcaption>
      </figure>
    </section>

    <section class="workspace" aria-label="Product search results">
      <aside class="filter-panel" aria-label="Filters">
        <h2>Filters</h2>
        ${selectControl("category", "Category", ["all", ...catalogFacets.categories], state.category)}
        ${selectControl("brand", "Brand", ["all", ...catalogFacets.brands], state.brand)}
        ${selectControl("size", "Size", ["all", ...catalogFacets.sizes], state.size)}
        ${selectControl("color", "Color", ["all", ...catalogFacets.colors], state.color)}
        <div class="filter-group">
          <label for="maxPrice">Max price: $${state.maxPrice}</label>
          <input id="maxPrice" type="range" min="15" max="100" step="5" value="${state.maxPrice}" />
        </div>
        <div class="filter-group">
          <label for="minDiscount">Minimum discount</label>
          <select id="minDiscount" class="select">
            ${[0, 15, 25, 40]
              .map(
                (value) =>
                  `<option value="${value}" ${Number(state.minDiscount) === value ? "selected" : ""}>${
                    value === 0 ? "Any markdown" : `${value}% or more`
                  }</option>`
              )
              .join("")}
          </select>
        </div>
      </aside>
      <div>
        <div class="toolbar">
          <div>
            <strong id="result-count"></strong>
            <span>In-stock offers only</span>
          </div>
          <select id="sort" class="select" aria-label="Sort products">
            ${[
              ["best-match", "Best match"],
              ["lowest-price", "Lowest price"],
              ["biggest-discount", "Biggest discount"],
              ["recently-updated", "Recently updated"]
            ]
              .map(([value, label]) => `<option value="${value}" ${state.sort === value ? "selected" : ""}>${label}</option>`)
              .join("")}
          </select>
        </div>
        <div id="results"></div>
      </div>
    </section>
  `;

  document.querySelector("#search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = document.querySelector("#query").value;
    updateResults();
  });

  document.querySelector("#query").addEventListener("input", (event) => {
    state.query = event.target.value;
    updateResults();
  });

  ["category", "brand", "size", "color", "maxPrice", "minDiscount", "sort"].forEach((id) => {
    document.querySelector(`#${id}`).addEventListener("input", (event) => {
      state[id] = event.target.value;
      updateResults();
      if (id === "maxPrice") renderSearch();
    });
  });

  document.querySelectorAll(".quick-category").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = state.category === button.dataset.category ? "all" : button.dataset.category;
      renderSearch();
    });
  });

  updateResults();
}

function selectControl(id, label, values, selected) {
  return html`
    <div class="filter-group">
      <label for="${id}">${label}</label>
      <select id="${id}" class="select">
        ${values
          .map((value) => {
            const labelText = value === "all" ? `All ${label.toLowerCase()}s` : value;
            return `<option value="${value}" ${selected === value ? "selected" : ""}>${labelText}</option>`;
          })
          .join("")}
      </select>
    </div>
  `;
}

function updateResults() {
  const results = filteredProducts();
  document.querySelector("#result-count").textContent = `${results.length} matching deals`;
  const root = document.querySelector("#results");

  if (!results.length) {
    root.innerHTML = `
      <div class="empty-state">
        <div>
          <h2>No matching deals</h2>
          <p>Try clearing a filter or raising your max price.</p>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `<div class="product-grid"></div>`;
  const grid = root.querySelector(".product-grid");
  results.forEach((product) => grid.appendChild(productCard(product, true)));
}

function productCard(product, showScore = false) {
  const template = document.querySelector("#product-card-template");
  const node = template.content.firstElementChild.cloneNode(true);
  const best = bestOffer(product);
  const percent = discount(product);
  const saved = readSaved().includes(product.id);

  node.querySelectorAll(".product-link").forEach((link) => {
    link.href = `#/products/${product.id}`;
  });
  node.querySelector(".product-image").src = product.image;
  node.querySelector(".product-image").alt = `${product.brand} ${product.title}`;
  node.querySelector(".brand-line").textContent = product.brand;
  node.querySelector("h3").textContent = product.title;
  node.querySelector(".badge-row").innerHTML = `
    ${percent > 0 ? `<span class="sale-badge">${percent}% off</span>` : ""}
    <span class="freshness">${freshness(product)}</span>
    ${showScore ? `<span class="chip">Match ${scoreProduct(product)}%</span>` : ""}
  `;
  node.querySelector(".price-line").innerHTML = `
    <strong>${money(best.currentPrice)}</strong>
    ${best.originalPrice > best.currentPrice ? `<s>${money(best.originalPrice)}</s>` : ""}
  `;
  node.querySelector(".offer-note").textContent = `Best price at ${best.store}`;
  node.querySelector(".sizes-line").textContent = `Sizes: ${best.availableSizes.join(" ")}`;

  const button = node.querySelector(".save-button");
  button.classList.toggle("active", saved);
  button.textContent = saved ? "♥" : "♡";
  button.addEventListener("click", () => toggleSaved(product.id));

  return node;
}

function toggleSaved(productId) {
  const saved = readSaved();
  const next = saved.includes(productId) ? saved.filter((id) => id !== productId) : [...saved, productId];
  writeSaved(next);
  render();
}

function renderProduct(productId) {
  const product = products.find((item) => item.id === productId);
  setActiveNav("");

  if (!product) {
    app.innerHTML = `<div class="empty-state"><div><h1>Product not found</h1><a class="primary-button" href="#/">Back to search</a></div></div>`;
    return;
  }

  const best = bestOffer(product);
  const similar = products
    .filter((item) => item.id !== product.id && (item.category === product.category || item.fit === product.fit))
    .slice(0, 3);

  app.innerHTML = html`
    <div class="detail-layout">
      <div class="detail-image">
        <img src="${product.image}" alt="${product.brand} ${product.title}" />
      </div>
      <section class="detail-summary">
        <a class="brand-line" href="#/">Back to search</a>
        <h1>${product.title}</h1>
        <div class="badge-row">
          <span class="chip">${product.brand}</span>
          <span class="chip">${product.category}</span>
          <span class="chip">${product.fit} fit</span>
          <span class="chip">${product.color}</span>
          <span class="freshness">${freshness(product)}</span>
          <span class="sale-badge">${discount(product)}% off</span>
        </div>
        <p>${product.description}</p>
        <div class="price-line">
          <strong>${money(best.currentPrice)}</strong>
          <s>${money(best.originalPrice)}</s>
          <span class="muted">Best price at ${best.store}</span>
        </div>
        <div class="detail-actions">
          <a class="primary-button" href="${best.url}" target="_blank" rel="noreferrer">View best deal</a>
          <button class="secondary-button" id="detail-save" type="button">${
            readSaved().includes(product.id) ? "Saved" : "Save item"
          }</button>
        </div>
        <p class="footer-note">
          Prices are seeded demo offers for the MVP. Production offers should include source,
          last-checked time, affiliate disclosure, stock status, and return/shipping context.
        </p>
        <table class="offer-table">
          <thead>
            <tr>
              <th>Store</th>
              <th>Price</th>
              <th>Shipping</th>
              <th>Sizes</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${product.offers
              .map(
                (item) => `
                  <tr>
                    <td>${item.store}</td>
                    <td><strong>${money(item.currentPrice)}</strong><div class="muted">Was ${money(item.originalPrice)}</div></td>
                    <td>${item.shipping}</td>
                    <td>${item.availableSizes.join(" ")}</td>
                    <td>${item.updatedHoursAgo}h ago</td>
                    <td><a class="secondary-button" href="${item.url}" target="_blank" rel="noreferrer">Store</a></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </section>
    </div>
    <section style="margin-top: 48px;">
      <div class="section-heading">
        <h1 style="font-size: clamp(1.8rem, 4vw, 3.4rem);">Similar deals</h1>
        <p>Same category or fit, ranked from the current seed catalog.</p>
      </div>
      <div class="product-grid" id="similar-products"></div>
    </section>
  `;

  document.querySelector("#detail-save").addEventListener("click", () => toggleSaved(product.id));
  const grid = document.querySelector("#similar-products");
  similar.forEach((item) => grid.appendChild(productCard(item)));
}

function renderSaved() {
  const savedProducts = products.filter((product) => readSaved().includes(product.id));
  app.innerHTML = html`
    <div class="section-heading">
      <div>
        <p class="eyebrow">Watchlist</p>
        <h1>Saved deals</h1>
      </div>
      <p>Track products you care about, then add price alerts when the data pipeline is connected.</p>
    </div>
    <div id="saved-list"></div>
  `;

  const root = document.querySelector("#saved-list");
  if (!savedProducts.length) {
    root.innerHTML = `
      <div class="empty-state">
        <div>
          <h2>No saved items yet</h2>
          <p>Save products from search results to build your first watchlist.</p>
          <a class="primary-button" href="#/">Find deals</a>
        </div>
      </div>
    `;
    return;
  }

  root.innerHTML = `<div class="product-grid"></div>`;
  savedProducts.forEach((product) => root.querySelector(".product-grid").appendChild(productCard(product)));
}

function renderPreferences() {
  const catalogFacets = facets();
  const preferences = readPreferences();
  app.innerHTML = html`
    <div class="section-heading">
      <div>
        <p class="eyebrow">Taste profile</p>
        <h1>Preferences</h1>
      </div>
      <p>Set sizes, brands, colors, fits, and budget so recommendations start useful before ML exists.</p>
    </div>
    <section class="panel">
      <div class="toolbar">
        <div>
          <strong>Recommendation inputs</strong>
          <span>${preferences.sizes.length} sizes / ${preferences.favoriteBrands.length} liked brands / $${preferences.minPrice}-${preferences.maxPrice}</span>
        </div>
        <div class="detail-actions" style="margin: 0;">
          <button class="secondary-button" id="reset-preferences" type="button">Reset</button>
          <button class="primary-button" id="save-preferences" type="button">Save preferences</button>
        </div>
      </div>
      <div class="preference-grid">
        ${checks("sizes", "Sizes", catalogFacets.sizes, preferences.sizes)}
        ${checks("favoriteBrands", "Favorite brands", catalogFacets.brands, preferences.favoriteBrands)}
        ${checks("dislikedBrands", "Disliked brands", catalogFacets.brands, preferences.dislikedBrands)}
        ${checks("colors", "Colors", catalogFacets.colors, preferences.colors)}
        ${checks("fits", "Fits", catalogFacets.fits, preferences.fits)}
        <div class="field">
          <label class="filter-label" for="minPricePreference">Minimum price</label>
          <input class="field-input" id="minPricePreference" type="number" min="0" value="${preferences.minPrice}" />
          <label class="filter-label" for="maxPricePreference">Maximum price</label>
          <input class="field-input" id="maxPricePreference" type="number" min="0" value="${preferences.maxPrice}" />
          <label class="filter-label" for="minDiscountPreference">Minimum discount</label>
          <input class="field-input" id="minDiscountPreference" type="number" min="0" max="90" value="${preferences.minDiscount}" />
        </div>
      </div>
    </section>
  `;

  document.querySelector("#save-preferences").addEventListener("click", () => {
    const next = {
      ...preferences,
      sizes: checkedValues("sizes"),
      favoriteBrands: checkedValues("favoriteBrands"),
      dislikedBrands: checkedValues("dislikedBrands"),
      colors: checkedValues("colors"),
      fits: checkedValues("fits"),
      minPrice: Number(document.querySelector("#minPricePreference").value),
      maxPrice: Number(document.querySelector("#maxPricePreference").value),
      minDiscount: Number(document.querySelector("#minDiscountPreference").value)
    };
    writePreferences(next);
    renderPreferences();
  });

  document.querySelector("#reset-preferences").addEventListener("click", () => {
    writePreferences(defaultPreferences);
    renderPreferences();
  });
}

function checks(name, label, values, selected) {
  return html`
    <fieldset class="field" style="border: 0; padding: 0; margin: 0;">
      <legend class="filter-label">${label}</legend>
      <div class="checkbox-list">
        ${values
          .map(
            (value) => `
              <label class="checkbox-row">
                <input type="checkbox" name="${name}" value="${value}" ${selected.includes(value) ? "checked" : ""} />
                ${value}
              </label>
            `
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function checkedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);
