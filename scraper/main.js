const Apify = require('apify');
const cheerio = require('cheerio');

Apify.main(async () => {
    console.log('Starting the scraper...');

    // Get input from the UI
    const input = await Apify.getInput();
    console.log('Received input:', input);

    // Ensure that the input contains a list of websites
    const websites = input.websites;
    if (!websites || !Array.isArray(websites)) {
        console.error('Invalid input: Input must contain an array of websites.');
        throw new Error('Input must contain an array of websites.');
    }

    console.log(`Number of websites to scrape: ${websites.length}`);

    // Initialize the request queue
    const requestQueue = await Apify.openRequestQueue();
    console.log('Request queue initialized');

    // Add each website in the list to the request queue
    for (const website of websites) {
        await requestQueue.addRequest({ url: website });
        console.log(`Added to queue: ${website}`);
    }

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
            } else {
                console.log(`No emails found on ${request.url}`);
            }

            // Find and add links to pages like "contact", "about", or "team"
            let enqueuedCount = 0;
            $('a[href]').each((index, el) => {
                const href = $(el).attr('href');
                const linkText = $(el).text().toLowerCase();
                if (href && href.startsWith('/') && (linkText.includes('contact') || linkText.includes('about') || linkText.includes('team'))) {
                    const absoluteUrl = new URL(href, request.loadedUrl).href;
                    requestQueue.addRequest({ url: absoluteUrl });
                    console.log(`Enqueued page: ${absoluteUrl}`);
                    enqueuedCount++;
                }
            });
            console.log(`Enqueued ${enqueuedCount} additional pages from ${request.url}`);
        },
        handleFailedRequestFunction: async ({ request }) => {
            console.log(`Request failed for ${request.url}`);
        },
    });

    // Start the crawler
    console.log('Starting the crawler...');
    await crawler.run();
    console.log('Crawler finished');
});
