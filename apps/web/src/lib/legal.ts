import { CONTACT } from '@sparky/ui'
import { DOCS, type DocSection } from './docs'

export interface LegalDoc {
  slug: 'privacy' | 'terms'
  title: string
  description: string
  sections: DocSection[]
}

export const LEGAL_UPDATED = 'October 22, 2026'
export const OPERATOR = 'ElixirLabs'

const PRIVACY_AND_DATA = DOCS.find((d) => d.slug === 'privacy-and-data')

if (!PRIVACY_AND_DATA) throw new Error('docs.ts has no privacy-and-data page for the privacy policy to reuse')

/** The app's privacy text is the docs page, not a copy: this policy renders its sections as they are. */
export const privacy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  description: 'What the Sparky website collects (nothing) and what the Sparky app keeps on your PC.',
  sections: [
    {
      h: 'Who we are',
      blocks: [{ p: `This website and the Sparky app are published by ${OPERATOR}. For any question about this policy, write to ${CONTACT.email}.` }],
    },
    {
      h: 'What this website collects',
      blocks: [
        {
          p: 'Nothing. The website has no accounts, forms, analytics, advertising or third-party scripts, and it stores nothing in your browser. Its fonts and images are served from the site itself.',
        },
        {
          p: 'The Download button links to GitHub Releases. Once you follow it, GitHub handles the request under its own terms.',
        },
      ],
    },
    {
      h: 'Hosting',
      blocks: [
        {
          p: 'The website is hosted on Vercel. Vercel processes standard request logs, such as your IP address and user agent, to serve and secure the site. We do not use those logs to identify visitors.',
        },
      ],
    },
    {
      h: 'Cookies',
      blocks: [{ p: 'None. The website sets no cookies, essential or otherwise, so it shows no cookie banner.' }],
    },
    {
      h: 'The Sparky app',
      blocks: [{ p: 'What follows is the Sparky docs page on privacy and data, shown here in full. It describes the app, which runs on your PC.' }],
    },
    ...PRIVACY_AND_DATA.sections,
    {
      h: 'Children',
      blocks: [{ p: 'The website and the app are not directed at children under 13, and we do not knowingly collect information from anyone.' }],
    },
    {
      h: 'Your choices and deletion',
      blocks: [
        {
          p: `The website holds no personal data about you. The app keeps its data on your PC, and the Delete Your Data section above says how to remove it. If you emailed ${CONTACT.email} and want that correspondence deleted, ask by email and it will be deleted.`,
        },
      ],
    },
    {
      h: 'Changes',
      blocks: [{ p: 'When this policy changes, the date under the title changes with it.' }],
    },
  ],
}

export const terms: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  description: 'The terms for using the Sparky website and app.',
  sections: [
    {
      h: 'Acceptance',
      blocks: [{ p: `By using this website or the Sparky app, you agree to these terms. They are published by ${OPERATOR}. If you do not agree, do not use them.` }],
    },
    {
      h: 'License',
      blocks: [
        { p: 'Sparky is free and open source under the MIT License. The license text is the LICENSE file in the Sparky repository on GitHub.' },
        { p: 'The programs Sparky ships keep their own licenses. They are listed in the Open source parts section of the docs and in THIRD_PARTY_NOTICES.md.' },
      ],
    },
    {
      h: 'Acceptable use',
      blocks: [
        { p: 'Use Sparky lawfully. You are responsible for the files you convert and the videos you save, including for having the right to do so.' },
        { p: 'Do not attempt to disrupt this website or probe it for weaknesses without permission.' },
      ],
    },
    {
      h: 'Third-party services',
      blocks: [
        {
          p: 'Sparky saves what another site serves to your PC when you give it a link. That depends on the terms of that site and the license of the content. Your use of those sites is governed by their terms, not these.',
        },
      ],
    },
    {
      h: 'No warranty',
      blocks: [{ p: 'The website and the app are provided “as is”, without warranty of any kind, as the MIT License states.' }],
    },
    {
      h: 'Limitation of liability',
      blocks: [
        {
          p: `To the extent the law allows, ${OPERATOR} is not liable for any damages arising from your use of the website or the app, including lost files or lost data.`,
        },
      ],
    },
    {
      h: 'Credits',
      blocks: [
        {
          ul: [
            'Satoshi, by the Indian Type Foundry, is distributed through Fontshare under the ITF Free Font License.',
            'IBM Plex Mono is licensed under the SIL Open Font License, Version 1.1.',
          ],
        },
      ],
    },
    {
      h: 'Changes',
      blocks: [{ p: 'These terms may change. The date under the title shows the latest revision, and continued use after a change means you accept it.' }],
    },
    {
      h: 'Contact',
      blocks: [{ p: `Questions about these terms: ${CONTACT.email}.` }],
    },
  ],
}

export const LEGAL: LegalDoc[] = [privacy, terms]
