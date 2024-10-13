import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

console.log('Starting the scraper...');

try {
    // Get input from the UI
    const input = await Actor.getInput();
    console.log('Received input:', { input });

    // Ensure that the input contains a list of websites
    const websites = input.websites;
    if (!websites || !Array.isArray(websites)) {
        throw new Error('Invalid input: Input must contain an array of websites.');
    }

    console.log(`Number of websites to scrape: ${websites.length}`);

    // Initialize the request queue
    const requestQueue = await Actor.openRequestQueue();
    console.log('Request queue initialized');

    // Add each website in the list to the request queue
    for (const website of websites) {
        await requestQueue.addRequest({ url: website });
        console.debug(`Added to queue: ${website}`);
    }

    // Create a dataset to store all scraped emails
    const dataset = await Actor.openDataset('scraped-emails');

    // Create a Cheerio-based crawler
    const crawler = new CheerioCrawler({
        requestQueue,
        proxyConfiguration: await Actor.createProxyConfiguration(),
        async requestHandler({ request, $, enqueueLinks }) {
            try {
                console.log(`Processing ${request.url}...`);

                // Look for email patterns in the text
                const textEmails = $('body').text().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

                // Look for email patterns in mailto links
                const mailtoLinks = $('a[href^="mailto:"]').map((i, el) => {
                    const href = $(el).attr('href');
                    return href ? href.replace('mailto:', '') : null;
                }).get();

                // Combine and deduplicate emails
                const emails = [...new Set([...textEmails, ...mailtoLinks])];

                if (emails.length > 0) {
                    console.log(`Emails found on ${request.url}: ${emails.join(', ')}`);
                    await dataset.pushData({ url: request.url, emails });
                } else {
                    console.log(`No emails found on ${request.url}`);
                }

                // Find and add links to pages like "contact", "about", or "team"
                await enqueueLinks({
                    globs: ['**/*contact*', '**/*about*', '**/*team*'],
                    label: 'DETAIL',
                });

            } catch (error) {
                console.error(`Error processing ${request.url}: ${error.message}`);
            }
        },
        failedRequestHandler({ request, error }) {
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
    await Actor.setValue('OUTPUT', scrapedData);
    console.log('Output data has been saved.');
} catch (error) {
    console.error('An error occurred during the actor run:', error);
    throw error;  // Re-throw the error so Apify knows the run failed
}

await Actor.exit();
