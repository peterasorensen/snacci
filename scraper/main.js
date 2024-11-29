import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

await Actor.init();

console.log('Starting the scraper...');

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

// Only used if remove duplicates option is selected
const emailMap = new Map();

// Add each website to the request queue
for (const website of websites) {
    await requestQueue.addRequest({ 
        url: website,
        userData: { depth: 0 } // Add initial depth for root URLs
    });
    console.debug(`Added to queue: ${website}`);
}

// Add this utility function at the top level
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.toLowerCase();
    } catch (e) {
        console.error(`Invalid URL: ${url}`);
        return null;
    }
}

// Create a Cheerio-based crawler
const crawler = new CheerioCrawler({
    requestQueue,
    proxyConfiguration: await Actor.createProxyConfiguration(),
    async requestHandler({ request, $, enqueueLinks }) {
        try {
            console.log(`Processing ${request.url}...`);
            const currentDomain = getDomain(request.url);
            const currentDepth = request.userData.depth || 0;

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
                
                for (const email of uniqueEmails) {
                    if (!input.removeDuplicateEmails || !emailMap.has(email)) {
                        emailMap.set(email, request.url);
                        await Actor.pushData({ email: email, sourceUrl: request.url });
                    }
                }
            } else {
                console.log(`No emails found on ${request.url}`);
            }

            // Only enqueue new links if we haven't reached max depth
            if (currentDepth < input.maxDepth) {
                let enqueuedCount = 0;
                await enqueueLinks({
                    globs: [
                        '**/*contact**',
                        '**/*about**', 
                        '**/*team**',
                        '**/contact**',
                        '**/about**',
                        '**/team**',
                        '**/contact',
                        '**/about',
                        '**/team',
                        '**/people**'
                    ],
                    label: 'DETAIL',
                    transformRequestFunction: (req) => {
                        console.debug(`Evaluating link: ${req.url}`);
                        if (enqueuedCount >= input.maxSpray) {
                            console.debug(`Skipping ${req.url} - reached max spray limit`);
                            return false;
                        }
                        const targetDomain = getDomain(req.url);
                        if (targetDomain === currentDomain) {
                            enqueuedCount++;
                            // Add depth information to the new request
                            req.userData = { depth: currentDepth + 1 };
                            console.debug(`Enqueuing link (${enqueuedCount}/${input.maxSpray}): ${req.url}`);
                            return req;
                        }
                        console.debug(`Skipping ${req.url} - different domain (${targetDomain} !== ${currentDomain})`);
                        return false; // Skip URLs from different domains
                    },
                });
            }

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

await Actor.exit();
