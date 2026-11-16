import { Img, Link } from '../components';
import { useBranding } from '../providers/branding';
import { getSafeBrandingUrl } from '../utils/branding-url';

export type TemplateBrandingLogoProps = {
  assetBaseUrl: string;
  className?: string;
};

/**
 * Renders the email logo.
 *
 * - When custom branding is enabled with a logo, the branding logo is shown.
 *   If a safe (http/https) Brand Website is configured, the logo links to it.
 * - Otherwise the Documenso logo is shown.
 * - Brite (RLN-410): an envelope logo (`branding.envelopeLogo`) wins over both. It is never
 *   a link and is drawn 300x60 with HTML width/height attributes, because Outlook desktop
 *   ignores CSS image heights and the caller's `h-6` would shrink it to 24 px.
 */
export const BRITE_ENVELOPE_LOGO_WIDTH = 300;
export const BRITE_ENVELOPE_LOGO_HEIGHT = 60;

export const TemplateBrandingLogo = ({ assetBaseUrl, className = 'mb-4 h-6' }: TemplateBrandingLogoProps) => {
  const branding = useBranding();

  if (branding.envelopeLogo) {
    return (
      <Img
        src={branding.envelopeLogo}
        alt="Logo"
        width={BRITE_ENVELOPE_LOGO_WIDTH}
        height={BRITE_ENVELOPE_LOGO_HEIGHT}
        className="mb-4"
        style={{
          width: `${BRITE_ENVELOPE_LOGO_WIDTH}px`,
          height: `${BRITE_ENVELOPE_LOGO_HEIGHT}px`,
          maxWidth: '100%',
        }}
      />
    );
  }

  const hasCustomBrandingLogo = branding.brandingEnabled && Boolean(branding.brandingLogo);

  if (!hasCustomBrandingLogo) {
    const documensoLogoUrl = new URL('/static/logo.png', assetBaseUrl).toString();

    return <Img src={documensoLogoUrl} alt="Brite Logo" className={className} />;
  }

  const brandingLogo = <Img src={branding.brandingLogo} alt="Branding Logo" className={className} />;

  const safeBrandingUrl = getSafeBrandingUrl(branding.brandingUrl);

  if (!safeBrandingUrl) {
    return brandingLogo;
  }

  return (
    <Link href={safeBrandingUrl} target="_blank">
      {brandingLogo}
    </Link>
  );
};

export default TemplateBrandingLogo;
