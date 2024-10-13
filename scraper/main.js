import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

const log = Actor.log;
log.info('Starting the scraper...');

try {
    // Get input from the UI
    const input = await Actor.getInput();
    log.info('Received input:', { input });

    // Ensure that the input contains a list of websites
    const websites = input.websites;
    if (!websites || !Array.isArray(websites)) {
        throw new Error('Invalid input: Input must contain an array of websites.');
    }

    log.info(`Number of websites to scrape: ${websites.length}`);

    // Initialize the request queue
    const requestQueue = await Actor.openRequestQueue();
    log.info('Request queue initialized');

    // Add each website in the list to the request queue
    for (const website of websites) {
        await requestQueue.addRequest({ url: website });
        log.debug(`Added to queue: ${website}`);
    }

    // Create a dataset to store all scraped emails
    const dataset = await Actor.openDataset('scraped-emails');

    // Create a Cheerio-based crawler
    const crawler = new CheerioCrawler({
        requestQueue,
        proxyConfiguration: await Actor.createProxyConfiguration(),
        async requestHandler({ request, $, enqueueLinks }) {
            try {
                log.info(`Processing ${request.url}...`);

                // Look for email patterns on the page
                const emails = $('body').text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                if (emails) {
                    const uniqueEmails = [...new Set(emails)]; // Remove duplicates
                    log.info(`Emails found on ${request.url}: ${uniqueEmails.join(', ')}`);
                    await dataset.pushData({ url: request.url, emails: uniqueEmails });
                } else {
                    log.info(`No emails found on ${request.url}`);
                }

                // Find and add links to pages like "contact", "about", or "team"
                await enqueueLinks({
                    globs: ['**/*contact*', '**/*about*', '**/*team*'],
                    label: 'DETAIL',
                });

            } catch (error) {
                log.error(`Error processing ${request.url}: ${error.message}`);
            }
        },
        failedRequestHandler({ request, error }) {
            log.error(`Request failed for ${request.url}: ${error.message}`);
        },
    });

    // Start the crawler
    log.info('Starting the crawler...');
    await crawler.run();
    log.info('Crawler finished');

    // Retrieve all scraped data from the dataset
    const scrapedData = await dataset.getData();

    // Set the output of the actor
    await Actor.setValue('OUTPUT', scrapedData);
    log.info('Output data has been saved.');
} catch (error) {
    log.error('An error occurred during the actor run:', error);
    throw error;  // Re-throw the error so Apify knows the run failed
}

await Actor.exit();
