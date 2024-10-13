const Apify = require('apify');
const cheerio = require('cheerio');

Apify.main(async () => {
    const website = 'https://example.com'; // Replace with your target website URL

    // Initialize the request queue
    const requestQueue = await Apify.openRequestQueue();
    await requestQueue.addRequest({ url: website });

    // Create a Cheerio-based crawler
    const crawler = new Apify.CheerioCrawler({
        requestQueue,
        proxyConfiguration: await Apify.createProxyConfiguration({ useApifyProxy: true }), // Use Apify Proxy
        handlePageFunction: async ({ request, $ }) => {
            console.log(`Processing ${request.url}...`);

            // Look for email patterns on the page
            const emails = $('body').text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
            if (emails) {
                console.log(`Emails found on ${request.url}: ${emails.join(', ')}`);
                await Apify.pushData({ url: request.url, emails });
            }

            // Find and add links to pages like "contact", "about", or "team"
            $('a[href]').each((index, el) => {
                const href = $(el).attr('href');
                const linkText = $(el).text().toLowerCase();
                if (href && href.startsWith('/') && (linkText.includes('contact') || linkText.includes('about') || linkText.includes('team'))) {
                    const absoluteUrl = new URL(href, request.loadedUrl).href;
                    requestQueue.addRequest({ url: absoluteUrl });
                    console.log(`Enqueued page: ${absoluteUrl}`);
                }
            });
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request failed for ${request.url}`);
        },
    });

    // Start the crawler
    await crawler.run();
});
