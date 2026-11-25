export type Tenant = {
  id: string;
  slug: string;
  name: string;
  portal: string;
  branding: { logoUrl?: string; displayName: string; primaryColor: string; timezone: string };
};
