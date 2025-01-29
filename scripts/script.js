// Init Swiper 
const swiper = new Swiper('.swiper', {
    direction: 'horizontal',
    loop: false,
    slidesPerView: 3,
    breakpoints: {
        768: {
            slidesPerView: 3,
        },
        480: {
            slidesPerView: 2,
        },
        0: {
            slidesPerView: 1,
        }
    },
    navigation: {
        nextEl: ".swiper-button-next",
        prevEl: ".swiper-button-prev",
    }
});

let regionalSettings = {};

const loadRegionalSettings = async () => {
    try {
        const response = await fetch('scripts/regionalSettings.json');
        regionalSettings = await response.json();
        processCarousels();
    } catch (error) {
        console.error("Error loading regional settings:", error);
    }
};

const getUserRegion = () => {
    const domain = window.location.hostname;
    const path = window.location.pathname;

    if (domain.includes(".co.uk")) {
        return "en";
    } else if (domain.includes(".eu")) {
        if (path.startsWith("/cz")) {
            return "cz";
        }
        return "bg";
    }
    return "en";
};

const getApiUrl = () => {
    const region = getUserRegion();
    const apiUrls = {
        uk: "https://wowtea.co.uk/wp-json/wp/v2/product/",
        bg: "https://wowtea.eu/wp-json/wp/v2/product/",
        cz: "https://wowtea.eu/cz/wp-json/wp/v2/product/"
    };
    return apiUrls[region] || apiUrls.uk;
};

const fetchProducts = async (ids) => {
    const url = getApiUrl();
    try {
        const requests = ids.map((id) => fetch(`${url}${id}`).then((res) => res.json()));
        return await Promise.all(requests);
    } catch (error) {
        console.error('Error fetching products:', error);
    }
};

const formatPrice = (price) => {
    return price ? parseFloat(price).toFixed(2) : "0.00";
};

const calculateDiscount = (regularPrice, salePrice) => {
    regularPrice = parseFloat(regularPrice);
    salePrice = parseFloat(salePrice);

    if (!salePrice || salePrice >= regularPrice || regularPrice === 0) return 0;
    return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
};

const processCarousels = async () => {
    const region = getUserRegion();
    const locale = regionalSettings[region] || regionalSettings.uk;
    const freeDeliveryThreshold = locale.deliveryThreshold;
    const carousels = locale.carousels;

    for (const [carouselName, ids] of Object.entries(carousels)) {
        const idSets = ids.map((idString) => idString.split('|'));
        const mainIds = idSets.map((idArray) => idArray[0]);

        const products = await fetchProducts(mainIds);

        const carouselData = products.map((product, index) => {
            const idArray = idSets[index];

            let salePrice = product.sale_price;
            let regularPrice = product.regular_price;

            if (idArray.length > 1) {
                const variationId = idArray[1];
                const variation = product.variations_data?.[variationId];
                if (variation) {
                    salePrice = variation.sale_price || variation.regular_price;
                    regularPrice = variation.regular_price;
                }
            }

            const newDiscount = calculateDiscount(regularPrice, salePrice);
            const oldDiscount = newDiscount > 10 ? newDiscount - 10 : 0;

            let badges = [];
            let hasFreeDelivery = parseFloat(salePrice) >= freeDeliveryThreshold;

            if (hasFreeDelivery) {
                badges.push(`${locale.freeDelivery}`, locale.freePlan);
            } else {
                badges.push(locale.freeFoodPlan);
            }

            return {
                title: product.title.rendered,
                regularPrice: formatPrice(regularPrice),
                salePrice: salePrice ? formatPrice(salePrice) : null,
                image: product.image,
                link: product.link,
                newDiscount: newDiscount,
                oldDiscount: oldDiscount,
                badges: badges,
            };
        });

        renderCarousel(carouselName, carouselData);
    }
};

const renderCarousel = (carouselName, products) => {
    const carouselContainer = document.querySelector(`.swiper.${carouselName} .swiper-wrapper`);
    if (!carouselContainer) return;

    carouselContainer.innerHTML = products
        .map((product) => {
            return `
                <div class="swiper-slide">
                    <div class="free-badges">
                        ${product.badges.map(badge => `<div class="free-badge">+ ${badge}</div>`).join('')}
                    </div>
                    <div class="slide-container">
                        <div class="discount-percentage__wrapper">
                            <img src="images/red-heart.svg" alt="heart">
                            <div class="discount-percentage">
                                <div class="old-percentage">-${product.oldDiscount}%</div>
                                <div class="new-percentage">-${product.newDiscount}%</div>
                            </div>
                        </div>
                        <img src="${product.image}" alt="${product.title}" class="slider-image"></img>
                        <h2>${product.title}</h2>
                        <div class="product-price">
                            <span class="new-price">${product.salePrice || product.regularPrice}</span>
                            ${product.salePrice ? `<span class="old-price">${product.regularPrice}</span>` : ''}
                        </div>
                        <div class="buy-button"><a href="${product.link}">buy now</a></div>
                    </div>
                </div>`;
        })
        .join('');
};

// Load regional settings and then process carousels
loadRegionalSettings();