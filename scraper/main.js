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

const domainMap = new Map();

// Add at the top with other Maps
const visitedUrls = new Set();

// Add each website to the request queue
for (const website of websites) {
    await requestQueue.addRequest({ 
        url: website,
        userData: { depth: 0 }  // Add initial depth
    });
    console.debug(`Added to queue: ${website}`);
}

// Create a Cheerio-based crawler
const crawler = new CheerioCrawler({
    requestQueue,
    proxyConfiguration: await Actor.createProxyConfiguration(),
    async requestHandler({ request, $, enqueueLinks }) {
        try {
            const currentDepth = request.userData?.depth || 0;
            
            // Normalize the URL (remove trailing slashes, etc)
            const normalizedUrl = request.url.toLowerCase().replace(/\/$/, '');
            if (visitedUrls.has(normalizedUrl)) {
                console.debug(`Already visited ${request.url}, skipping.`);
                return;
            }
            visitedUrls.add(normalizedUrl);

            domainMap.set(getBaseDomain(request.url), (domainMap.get(getBaseDomain(request.url)) || 1));
            // If the domain has been scraped maxScrapePerDomain times, skip it
            if (domainMap.get(getBaseDomain(request.url)) >= input.maxScrapePerDomain) {
                console.debug(`The domain has been scraped ${input.maxScrapePerDomain} times, skip it.`);
                return;
            }

            // If we've reached max depth, don't enqueue more links
            if (currentDepth >= input.maxDepth) {
                console.debug(`Reached max depth of ${input.maxDepth}, won't enqueue more links.`);
                return;
            }

            console.log(`Processing ${request.url}... (depth: ${currentDepth})`);

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

            await enqueueLinks({
                globs: [
                    '**/*contact*/**',
                    '**/*about*/**',
                    '**/*team*/**',
                    '**/*people*/**',
                    '**/*email*/**',
                    '**/*mail*/**'
                ],
                label: 'DETAIL',
                limit: input.maxLinksPerPage,
                strategy: 'same-domain',
                transformRequestFunction: (req) => {
                    // Pass the incremented depth to new requests
                    req.userData = { depth: currentDepth + 1 };
                    domainMap.set(getBaseDomain(request.url), (domainMap.get(getBaseDomain(request.url)) || 1) + 1);
                    return req;
                }
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

await Actor.exit();

// Utility function to get base domain from URL
function getBaseDomain(url) {
    try {
        return (new URL(url)).hostname.replace('www.', '');
    } catch (e) {
        console.error(`Invalid URL: ${url}`);
        return null;
    }
}
