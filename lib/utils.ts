import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const techIconBaseURL = "https://cdn.jsdelivr.net/gh/devicons/devicon/icons";

const normalizeTechName = (tech: string) => {
  const key = tech.toLowerCase().replace(/\.js$/, "").replace(/\s+/g, "");
  return mappings[key as keyof typeof mappings];
};

const checkIconExists = async (url: string) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok; // Returns true if the icon exists
  } catch {
    return false;
  }
};

export const getTechLogos = async (techArray: string[]) => {
  // Add safety check for undefined/null/invalid arrays
  if (!techArray || !Array.isArray(techArray) || techArray.length === 0) {
    return [];
  }

  // Filter out any falsy values and ensure all items are strings
  const validTechArray = techArray.filter(
    (tech) => tech && typeof tech === "string"
  );

  if (validTechArray.length === 0) {
    return [];
  }

  const logoURLs = validTechArray.map((tech) => {
    const normalized = normalizeTechName(tech);
    return {
      tech,
      url: normalized
        ? `${techIconBaseURL}/${normalized}/${normalized}-original.svg`
        : "/tech.svg",
    };
  });

  try {
    const results = await Promise.all(
      logoURLs.map(async ({ tech, url }) => ({
        tech,
        url:
          url !== "/tech.svg" && (await checkIconExists(url))
            ? url
            : "/tech.svg",
      }))
    );

    return results;
  } catch (error) {
    console.error("Error fetching tech logos:", error);
    // Return fallback data if Promise.all fails
    return validTechArray.map((tech) => ({
      tech,
      url: "/tech.svg",
    }));
  }
};

export const getRandomInterviewCover = () => {
  if (!interviewCovers || interviewCovers.length === 0) {
    return "/covers/default-cover.jpg"; // fallback cover
  }

  const randomIndex = Math.floor(Math.random() * interviewCovers.length);
  return `/covers${interviewCovers[randomIndex]}`;
};
