# coinsbee

TypeScript implementation of a coinsbee.com client using the fetch API.

Strictly focused on the workflow required to make a purchase via the platform and retrieve the digital item, with privacy features.

## Usage

Set environment variable `TWOCAPTCHA_API_KEY`

```sh
npm install -g
coinsbee init
coinsbee signup --email smartshopper@gmail.com --password GiftsAreNiceToGive11$ --firstname Smart --lastname Shopper --street '1 Tally Dr' --postcode 02879 --city 'Wakefield' --country 'US' --birthday '01/01/1980'
# an activation link will be sent to the E-mail
coinsbee login --email smartshopper@gmail.com --password GiftsAreNiceToGive11$
```

It is possible to initialize a proxy via a valid socks5 or http URI with a command similar to the following

```sh
coinsbee set-proxy socks5://127.0.0.1:1080
```

To retrieve an updated list of cards sold on the platform:

```sh
coinsbee get-products
```

Specify a search with the following command

```sh
coinsbee get-products --search Uber
```

Retrieve data for a specific gift card:

```sh
coinsbee load-product --name DoorDash
```

Add a specific product to cart.

For product listings that do not have an explicit amount in the label, it is possible to append a `_` character followed by the integer amount that should be purchased for the card. An example for a DoorDash $200 gift card is given below:

```sh
coinsbee add-to-cart --id 17243_200
```

A `-q` flag can be used with add-to-cart to specify quantity, i.e.

```sh
coinsbee add-to-cart --id 17243_200 -q 3
```

Retrieve the active shopping cart:

```sh
coinsbee get-shopping-cart
```

Example commands for the checkout workflow are given below:

```sh
coinsbee checkout
coinsbee checkout-processing --currency ETH
coinsbee checkout-proceed --coin ETH
```

Retrieve order history for an account:

```sh
coinsbee user-orders
```

Optionally, specify a `--length` flag (default 100 items returned by the API call) and/or a `--from` flag (defaults to current timestamp in ms minus 1 month).

```sh
coinsbee user-orders-details --orderid <orderid> --hash <hash>
```

Retrieve the order status, code, PIN, and URL associated with a given order.

## Author

Pyrosec Labs
