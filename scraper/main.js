const Apify = require('apify');

Apify.main(async () => {
    try {
        console.log('Starting the scraper...');

        // Get input from the UI
        const input = await Apify.getInput();
        console.log('Received input:', input);

        // Ensure that the input contains a list of websites
        const websites = input.websites;
        if (!websites || !Array.isArray(websites)) {
            throw new Error('Invalid input: Input must contain an array of websites.');
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

        // Create a dataset to store all scraped emails
        const dataset = await Apify.openDataset('scraped-emails');

        // Create a Cheerio-based crawler
        const crawler = new Apify.CheerioCrawler({
            requestQueue,
            proxyConfiguration: await Apify.createProxyConfiguration({ useApifyProxy: true }),
            handlePageFunction: async ({ request, $ }) => {
                try {
                    console.log(`Processing ${request.url}...`);

                    // Look for email patterns on the page
                    const emails = $('body').text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                    if (emails) {
                        const uniqueEmails = [...new Set(emails)]; // Remove duplicates
                        console.log(`Emails found on ${request.url}: ${uniqueEmails.join(', ')}`);
                        await dataset.pushData({ url: request.url, emails: uniqueEmails });
                    } else {
                        console.log(`No emails found on ${request.url}`);
                    }

                    // Find and add links to pages like "contact", "about", or "team"
                    let enqueuedCount = 0;
                    $('a[href]').each((index, el) => {
                        const href = $(el).attr('href');
                        const linkText = $(el).text().toLowerCase();
                        if (href && (href.startsWith('/') || href.startsWith('http'))) {
                            try {
                                const absoluteUrl = new URL(href, request.loadedUrl).href;
                                if (linkText.includes('contact') || linkText.includes('about') || linkText.includes('team')) {
                                    requestQueue.addRequest({ url: absoluteUrl }, { forefront: true });
                                    console.log(`Enqueued page: ${absoluteUrl}`);
                                    enqueuedCount++;
                                }
                            } catch (error) {
                                console.error(`Error processing URL ${href}: ${error.message}`);
                            }
                        }
                    });
                    console.log(`Enqueued ${enqueuedCount} additional pages from ${request.url}`);
                } catch (error) {
                    console.error(`Error processing ${request.url}: ${error.message}`);
                }
            },
            handleFailedRequestFunction: async ({ request, error }) => {
                console.error(`Request failed for ${request.url}: ${error.message}`);
            },
        });

        // Start the crawler
        console.log('Starting the crawler...');
        await crawler.run();
        console.log('Crawler finished');

        // Retrieve all scraped data from the dataset
        const scrapedData = await dataset.getData();

        // Set the output of the actor
        await Apify.setValue('OUTPUT', scrapedData);
        console.log('Output data has been saved.');
    } catch (error) {
        console.error('An error occurred during the actor run:', error);
        throw error;  // Re-throw the error so Apify knows the run failed
    }
});
