# gamez-telegram-scraper
A small Node script to pull all boss datas from GameZBD Telegram Bot NA/EU.

## Environment variables
Setup your ".env" file according to the included ".env.example".

Some variables need to be the same as ones you set from your cloudflare-workers deploy.

This project needs an external cronjob service (ex: cron-job.org) to run "/cron" enpoint periodically (ex: every 10mins) for updating boss data to your cloudflare worker.