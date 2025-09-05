# Welplan
A full-stack web application for interacting with the Samsung Welstory cafeteria API using the [`welstory-api-wrapper`](https://github.com/pmh-only/welstory-api-wrapper) library.

## Demo
https://welplan.pmh.codes

## How to run
first, sign up your welstory account from [Welplus application](https://play.google.com/store/apps/details?id=com.welstory.welplus).

and simply run:
```sh
docker -itp 3000:3000 \
   -v ./cache/:/app/cache/ \
   -e WELSTORY_USERNAME="<username>" \
   -e WELSTORY_PASSWORD="<password>" \
   ghcr.io/pmh-only/welplan:latest
```

WelPlan is now on http://localhost:3000 !

## Copyright
&copy; 2025. Minhyeok Park <pmh_only@pmh.codes>. MIT Licensed.
