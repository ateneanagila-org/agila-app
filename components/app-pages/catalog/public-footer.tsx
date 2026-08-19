import Image from "next/image";
import { Mail } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa6";

/**
 * Footer for the public catalog only (`/`). Deliberately a server component —
 * it is static markup, so it ships no client JavaScript.
 *
 * Sits on brand-dark to bookend the header in `app/(public)/layout.tsx`, which
 * uses the same colour. The band runs full-bleed; its content uses the header's
 * container (`max-w-7xl px-4`) rather than CatalogScreen's narrower `max-w-6xl`,
 * so the footer brand lines up under the header brand instead of floating
 * inset from it on wide screens.
 */

const LINKS = [
  {
    href: "https://www.facebook.com/AteneanAgila/",
    icon: FaFacebookF,
    label: "AteneanAgila",
    srLabel: "AGILA on Facebook",
  },
  {
    href: "https://www.instagram.com/atenean_agila",
    icon: FaInstagram,
    label: "atenean_agila",
    srLabel: "AGILA on Instagram",
  },
  {
    href: "mailto:ateneanagila@gmail.com",
    icon: Mail,
    label: "ateneanagila@gmail.com",
    srLabel: "Email AGILA",
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="w-full bg-brand-dark">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 tablet:py-14">
        <div className="flex flex-col gap-9 tablet:flex-row tablet:items-start tablet:justify-between tablet:gap-12">
          {/* Identity */}
          <div className="tablet:max-w-md">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logos/white-no-text.png"
                alt=""
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
              />
              <span className="font-brand text-xl font-bold leading-none tracking-wider text-white">
                AGILA
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-cream/70">
              The Ateneans Guided and Inspired by Love for Animals (AGILA) is an
              organization advocating for animal welfare.
            </p>
          </div>

          {/* Contacts */}
          <div className="shrink-0">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">
              Contact
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {LINKS.map(({ href, icon: Icon, label, srLabel }) => {
                const external = href.startsWith("http");
                return (
                  <li key={href}>
                    <a
                      href={href}
                      {...(external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      aria-label={srLabel}
                      className="group inline-flex items-center gap-3 rounded-full text-sm text-brand-cream/75 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-brand-cream transition-colors group-hover:bg-brand-orange group-hover:text-white">
                        <Icon aria-hidden className="h-3.5 w-3.5" />
                      </span>
                      <span className="break-all">{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
