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

```
coinsbee set-proxy socks5://127.0.0.1:1080
```


## Author

Pyrosec Labs
