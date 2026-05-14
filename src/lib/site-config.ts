import siteData from "../../content/site/info.json";

export const SITE = {
  name: siteData.name,
  shortName: siteData.shortName,
  tagline: siteData.tagline,
  description: siteData.description,
  email: siteData.email,
  phone: siteData.phone,
  phoneRaw: siteData.phoneRaw,
  address: siteData.address,
  mapUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2001.5!2d10.7942!3d59.8963!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46416e5c8b4a0a0b%3A0x0!2sRyenstubben+2%2C+0679+Oslo!5e0!3m2!1sno!2sno!4v1",
  social: siteData.social,
};

export const STATS = siteData.stats;
