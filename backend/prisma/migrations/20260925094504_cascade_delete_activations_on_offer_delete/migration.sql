ALTER TABLE "Activation" DROP CONSTRAINT "Activation_offerId_fkey";
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
