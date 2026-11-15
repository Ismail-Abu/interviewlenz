export function CompanyRail() {
  return (
    <section aria-label="Company interview styles" className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-18">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Practice in the style of
      </p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-6 opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0 sm:gap-x-14">
        {/* Google */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span className="font-semibold text-foreground">Google</span>
        </li>

        {/* Amazon */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-auto" viewBox="0 0 100 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <text
              x="2"
              y="18"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontWeight="800"
              fontSize="19"
              fill="currentColor"
              letterSpacing="-0.04em"
            >
              amazon
            </text>
            <path d="M 6 22 C 30 29.5, 65 29.5, 88 20" fill="none" stroke="#FF9900" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M 84 17.5 L 90.5 20.5 L 86 24 Z" fill="#FF9900" />
          </svg>
          <span className="sr-only">Amazon</span>
        </li>

        {/* Meta */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true" fill="#0866FF" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
          </svg>
          <span className="font-semibold text-foreground">Meta</span>
        </li>

        {/* Stripe */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true" fill="#635BFF" xmlns="http://www.w3.org/2000/svg">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
          </svg>
          <span className="font-semibold text-foreground">Stripe</span>
        </li>

        {/* Microsoft */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-6" viewBox="0 0 72 72" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect fill="#F25022" width="34.2" height="34.2" />
            <rect x="37.8" fill="#7FBA00" width="34.2" height="34.2" />
            <rect y="37.8" fill="#00A4EF" width="34.2" height="34.2" />
            <rect x="37.8" y="37.8" fill="#FFB900" width="34.2" height="34.2" />
          </svg>
          <span className="font-semibold text-foreground">Microsoft</span>
        </li>

        {/* NVIDIA */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true" fill="#76B900" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.948 8.798v-1.43a6.7 6.7 0 0 1 .424-.018c3.922-.124 6.493 3.374 6.493 3.374s-2.774 3.851-5.75 3.851c-.398 0-.787-.062-1.158-.185v-4.346c1.528.185 1.837.857 2.747 2.385l2.04-1.714s-1.492-1.952-4-1.952a6.016 6.016 0 0 0-.796.035m0-4.735v2.138l.424-.027c5.45-.185 9.01 4.47 9.01 4.47s-4.08 4.964-8.33 4.964c-.37 0-.733-.035-1.095-.097v1.325c.3.035.61.062.91.062 3.957 0 6.82-2.023 9.593-4.408.459.371 2.34 1.263 2.73 1.652-2.633 2.208-8.772 3.984-12.253 3.984-.335 0-.653-.018-.971-.053v1.864H24V4.063zm0 10.326v1.131c-3.657-.654-4.673-4.46-4.673-4.46s1.758-1.944 4.673-2.262v1.237H8.94c-1.528-.186-2.73 1.245-2.73 1.245s.68 2.412 2.739 3.11M2.456 10.9s2.164-3.197 6.5-3.533V6.201C4.153 6.59 0 10.653 0 10.653s2.35 6.802 8.948 7.42v-1.237c-4.84-.6-6.492-5.936-6.492-5.936z" />
          </svg>
          <span className="font-semibold text-foreground">NVIDIA</span>
        </li>

        {/* Figma */}
        <li className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <svg className="h-6 w-6" viewBox="0 0 200 300" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 300c27.6 0 50-22.4 50-50v-50H50c-27.6 0-50 22.4-50 50s22.4 50 50 50z" fill="#0ACF83" />
            <path d="M0 150c0-27.6 22.4-50 50-50h50v100H50c-27.6 0-50-22.4-50-50z" fill="#A259FF" />
            <path d="M0 50C0 22.4 22.4 0 50 0h50v100H50C22.4 100 0 77.6 0 50z" fill="#F24E1E" />
            <path d="M100 0h50c27.6 0 50 22.4 50 50s-22.4 50-50 50h-50V0z" fill="#FF7262" />
            <path d="M200 150c0 27.6-22.4 50-50 50s-50-22.4-50-50 22.4-50 50-50z" fill="#1ABCFE" />
          </svg>
          <span className="font-semibold text-foreground">Figma</span>
        </li>
      </ul>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Logos identify the interview style. Not affiliated with or endorsed by these companies.
      </p>
    </section>
  );
}
