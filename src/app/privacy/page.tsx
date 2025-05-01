import React from 'react'

const PrivacyPage = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="mb-4">
        This Privacy Policy describes how Netbones collects, uses, and discloses your personal
        information when you visit or make a purchase from [Your Website Address] (the “Site”).
      </p>

      <h2 className="text-2xl font-semibold mb-4">Personal Information We Collect</h2>
      <p className="mb-4">
        When you visit the Site, we collect certain information about your device, your interaction
        with the Site, and information necessary to process your purchases. We may also collect
        additional information if you contact us for customer support. In this Privacy Policy, we
        refer to any information about an identifiable individual (including the information below)
        as “Personal Information”.
      </p>
      <h3 className="text-xl font-medium mb-2">Device information</h3>
      <ul className="list-disc list-inside mb-4">
        <li>
          Examples of Personal Information collected: version of web browser, IP address, time zone,
          cookie information, what sites or products you view, search terms, and how you interact
          with the Site.
        </li>
        <li>
          Purpose of collection: to load the Site accurately for you, and to perform analytics on
          Site usage to optimize our Site.
        </li>
        <li>
          Source of collection: Collected automatically when you access our Site using cookies, log
          files, web beacons, tags, or pixels.
        </li>
        <li>Disclosure for a business purpose: shared with our processor Vercel.</li>
      </ul>

      <h2 className="text-2xl font-semibold mb-4">Sharing Your Personal Information</h2>
      <p className="mb-4">
        We share your Personal Information with service providers to help us provide our services
        and fulfill our contracts with you, as described above. For example:
      </p>
      <ul className="list-disc list-inside mb-4">
        <li>
          We use Vercel to power our online store — you can read more about how Vercel uses your
          Personal Information here: [Link to Service Provider Privacy Policy].
        </li>
        <li>
          We may share your Personal Information to comply with applicable laws and regulations, to
          respond to a subpoena, search warrant or other lawful request for information we receive,
          or to otherwise protect our rights.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
      <p className="mb-4">
        If you are a resident of the EEA, you have the right to access Personal Information we hold
        about you, to port it to a new service, and to ask that your Personal Information be
        corrected, updated, or erased. If you would like to exercise this right, please contact us
        through the contact information below.
      </p>
      <p className="mb-4">
        Additionally, if you are a resident of the EEA, we note that we are processing your
        information in order to fulfill contracts you might have with us (for example through the
        Site), or otherwise to pursue our legitimate business interests listed above. Additionally,
        please note that your information will be transferred outside of Europe, including to Canada
        and the United States.
      </p>

      <h2 className="text-2xl font-semibold mb-4">Contact</h2>
      <p className="mb-4">
        For more information about our privacy practices, if you have questions, or if you would
        like to make a complaint, please contact us by e-mail at [email address] or by mail using
        the details provided below:
      </p>
      <p>
        Netbones Solutions Pty Ltd
        <br />
        Cape Town
        <br />
        Cape Town, 7948
        <br />
        South Africa
        <br />
        hello@netbones.co.za
        <br />
      </p>
    </div>
  )
}

export default PrivacyPage
