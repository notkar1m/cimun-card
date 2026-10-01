-- Vendors can now have a website link, shown to delegates on the offer detail page.

ALTER TABLE "Offer" ADD COLUMN "websiteUrl" TEXT;
