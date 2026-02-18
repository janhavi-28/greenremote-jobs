declare module "@atharvh01/linkedin-jobs-api/src/services/linkedinService.js" {
  export function fetchJobListings(
    keywords: string,
    location: string,
    dateSincePosted?: string
  ): Promise<
    {
      title?: string;
      company?: string;
      location?: string;
      link?: string;
      description?: string;
    }[]
  >;
}