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

                // Look for email patterns on the page
                const emails = $.html().match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

                // Extract emails from custom attributes
                $('a[data-mail-name][data-mail-host]').each((index, element) => {
                    const mailName = $(element).attr('data-mail-name');
                    const mailHost = $(element).attr('data-mail-host');
                    if (mailName && mailHost) {
                        emails.push(`${mailName}@${mailHost}`);
                    }
                });

                if (emails.length > 0) {
                    const uniqueEmails = [...new Set(emails)]; // Remove duplicates
                    console.log(`Emails found on ${request.url}: ${uniqueEmails.join(', ')}`);
                    await dataset.pushData({ url: request.url, emails: uniqueEmails });
                    // Set the output of the actor
                    await Actor.setValue('OUTPUT', scrapedData);
                    console.log('Output data has been saved.');
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
} catch (error) {
    console.error('An error occurred during the actor run:', error);
    throw error;  // Re-throw the error so Apify knows the run failed
}

await Actor.exit();
