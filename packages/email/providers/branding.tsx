import type { EmailBrandingColors } from '@documenso/lib/utils/email-branding-colors';
import { createContext, useContext } from 'react';

type BrandingContextValue = {
  brandingEnabled: boolean;
  brandingUrl: string;
  brandingLogo: string;
  brandingCompanyDetails: string;
  brandingHidePoweredBy: boolean;
  brandingColors?: EmailBrandingColors;
  /**
   * Brite (RLN-410): the envelope's own logo (`DocumentMeta.emailLogoUrl`), already checked
   * against the team and URL allowlists. When set it replaces the team and Brite logo.
   */
  envelopeLogo?: string;
};

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

const defaultBrandingContextValue: BrandingContextValue = {
  brandingEnabled: false,
  brandingUrl: '',
  brandingLogo: '',
  brandingCompanyDetails: '',
  brandingHidePoweredBy: false,
};

export const BrandingProvider = (props: { branding?: BrandingContextValue; children: React.ReactNode }) => {
  return (
    <BrandingContext.Provider value={props.branding ?? defaultBrandingContextValue}>
      {props.children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const ctx = useContext(BrandingContext);

  if (!ctx) {
    throw new Error('Branding context not found');
  }

  return ctx;
};

export type BrandingSettings = BrandingContextValue;
