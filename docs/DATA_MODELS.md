# Data Models

Source of truth: `src/app/models/*.ts`. Field-by-field guide below (concise;
see the files for exact optionality).

## Products and variants (`product.model.ts`)

- `Product`: `id` (stable slug), `sku`, `name` (**untranslated by design**),
  `description` (neutral facts; **no medical claims**), `categoryId`
  (stable id, never a display name), `price` + optional `salePrice` (USD
  base, mock), `images[]`, `rating`, `reviewsCount`, `soldCount`, `stock`,
  flags (`isNew/isFeatured/isPopular` drive home sections), `tags[]`
  (search + related matching), `attributes[{name,value}]`,
  `variants?[{id,name,options[]}]`, `createdAt`.
- Helpers: `effectivePrice()` (sale ?? price), `discountPercent()`,
  `availabilityOf()` (stock → `in_stock|low_stock|out_of_stock`).
- `CatalogQuery`: `search, categoryId, minPrice, maxPrice, availability,
  inStockOnly, onSaleOnly, tags, sort, page, pageSize`. `SortKey`: six modes.

## Categories (`product.model.ts`)

- `Category`: stable `id`; `name` (English mirror); `names: LocalizedText`
  (dashboard-managed, English fallback); `description` + optional
  `descriptions`; `image`; `sortOrder`; `isActive` (inactive hides from
  nav/filters; products/orders fall back gracefully); `productCount?`.
- `LocalizedText`: required `en`, optional other seven languages.

## Cart (`cart.model.ts`)

- `CartItem { productId, variantKey?, variantLabel?, qty }` (persisted);
  `CartLine = CartItem + key`; `cartLineKey()` =
  `productId` or `productId::variantKey` — the **sole identity rule**.
- Display join: `EnrichedCartLine` in `cart-view.service.ts`
  (`product | null`, `unit`, `lineTotal`, `unavailable`).

## Favorites

Plain `string[]` of product ids (`FavoritesStore`); no model file needed.

## Hotels and delivery (`hotel.model.ts`)

- `Hotel`: stable `id`; `name` (+ optional `names`); `city` (data-driven
  filter source); `area?`; `isActive`; `sortOrder`; `zoneId` (future rules);
  `deliveryFee` (**sample**, mock only); `notes?`; `coordinates?`.
- `DeliveryQuote { hotelId, fee, currency, source: 'sample'|'api' }` —
  `source` tells the UI whether the fee is authoritative.

## Checkout and orders (`order.model.ts`)

- `CheckoutFormValue`: contact (name/phone/email?) + destination (`city`,
  `hotelId`, `hotelName` snapshot, `room?`, `notes?`) + `contactMethod`.
  Hotel referenced by id, displayed by snapshot name.
- `OrderItemInput`: priced line snapshot (`productId/productName/image/
  unitPrice/qty/variantLabel?`) — immune to later catalog changes.
- `CreateOrderRequest`: customer + items + `subtotal/deliveryFee/total` +
  `currency` + `paymentMethod: 'cash_on_delivery'` (only method).
- `Order`: + `id`, `orderNumber` (`NM-YYYY-####`), `status`
  (`pending|confirmed|shipped|delivered|cancelled`), `createdAt`, `userId?`.

## Auth and pending actions (`user.model.ts`, `pending-action.service.ts`)

- `User { id, name, email, phone? }`; `LoginRequest`, `RegisterRequest`,
  `AuthResponse { user, token }` (mock shape mirrors the future contract).
- `ReturnIntent { returnUrl, reason, action? }`;
  `PendingShoppingAction` = `add-to-cart{productId,qty,variantKey?,
  variantLabel?}` | `add-to-favorite{productId}`.
- `GateReason = addToCart|addToFavorites|checkout|account` (doubles as
  `gate.*` translation keys).

## API envelopes (`api.model.ts`)

- `ApiResponse<T> { data, message?, success }`, `PagedResult<T>`,
  `ApiError { status, message, errors? }`. Backend convention: RFC 7807
  `ProblemDetails` + camelCase + string enums (see API_CONTRACT.md).

## Identity and relationship rules

- Products↔categories, cart lines, order items: join on stable ids only.
- Display names (category/hotel) are never keys; snapshots (hotel name,
  order items/prices) freeze history against later edits.
