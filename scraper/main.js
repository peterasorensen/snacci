const Apify = require('apify');

Apify.main(async () => {
    Apify.utils.log.info('Starting the scraper...');
    // try {
    //     Apify.utils.log.info('Starting the scraper...');

    //     // Get input from the UI
    //     const input = await Apify.getInput();
    //     Apify.utils.log.info('Received input:', { input });

    //     // Ensure that the input contains a list of websites
    //     const websites = input.websites;
    //     if (!websites || !Array.isArray(websites)) {
    //         throw new Error('Invalid input: Input must contain an array of websites.');
    //     }

    //     Apify.utils.log.info(`Number of websites to scrape: ${websites.length}`);

    //     // Initialize the request queue
    //     const requestQueue = await Apify.openRequestQueue();
    //     Apify.utils.log.info('Request queue initialized');

    //     // Add each website in the list to the request queue
    //     for (const website of websites) {
    //         await requestQueue.addRequest({ url: website });
    //         Apify.utils.log.debug(`Added to queue: ${website}`);
    //     }

    //     // Create a dataset to store all scraped emails
    //     const dataset = await Apify.openDataset('scraped-emails');

    //     // Create a Cheerio-based crawler
    //     const crawler = new Apify.CheerioCrawler({
    //         requestQueue,
    //         proxyConfiguration: await Apify.createProxyConfiguration({ useApifyProxy: true }),
    //         handlePageFunction: async ({ request, $ }) => {
    //             try {
    //                 Apify.utils.log.info(`Processing ${request.url}...`);

    //                 // Look for email patterns on the page
    //                 const emails = $('body').text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    //                 if (emails) {
    //                     const uniqueEmails = [...new Set(emails)]; // Remove duplicates
    //                     Apify.utils.log.info(`Emails found on ${request.url}: ${uniqueEmails.join(', ')}`);
    //                     await dataset.pushData({ url: request.url, emails: uniqueEmails });
    //                 } else {
    //                     Apify.utils.log.info(`No emails found on ${request.url}`);
    //                 }

    //                 // Find and add links to pages like "contact", "about", or "team"
    //                 let enqueuedCount = 0;
    //                 $('a[href]').each((index, el) => {
    //                     const href = $(el).attr('href');
    //                     const linkText = $(el).text().toLowerCase();
    //                     if (href && (href.startsWith('/') || href.startsWith('http'))) {
    //                         try {
    //                             const absoluteUrl = new URL(href, request.loadedUrl).href;
    //                             if (linkText.includes('contact') || linkText.includes('about') || linkText.includes('team')) {
    //                                 requestQueue.addRequest({ url: absoluteUrl }, { forefront: true });
    //                                 Apify.utils.log.debug(`Enqueued page: ${absoluteUrl}`);
    //                                 enqueuedCount++;
    //                             }
    //                         } catch (error) {
    //                             Apify.utils.log.error(`Error processing URL ${href}: ${error.message}`);
    //                         }
    //                     }
    //                 });
    //                 Apify.utils.log.info(`Enqueued ${enqueuedCount} additional pages from ${request.url}`);
    //             } catch (error) {
    //                 Apify.utils.log.error(`Error processing ${request.url}: ${error.message}`);
    //             }
    //         },
    //         handleFailedRequestFunction: async ({ request, error }) => {
    //             Apify.utils.log.error(`Request failed for ${request.url}: ${error.message}`);
    //         },
    //     });

    //     // Start the crawler
    //     Apify.utils.log.info('Starting the crawler...');
    //     await crawler.run();
    //     Apify.utils.log.info('Crawler finished');

    //     // Retrieve all scraped data from the dataset
    //     const scrapedData = await dataset.getData();

    //     // Set the output of the actor
    //     await Apify.setValue('OUTPUT', scrapedData);
    //     Apify.utils.log.info('Output data has been saved.');
    // } catch (error) {
    //     Apify.utils.log.error('An error occurred during the actor run:', error);
    //     throw error;  // Re-throw the error so Apify knows the run failed
    // }
});
