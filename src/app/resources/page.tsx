'use client'

import React from 'react'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const Resources: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow pt-24 pb-16 px-4">
        <section className="container mx-auto max-w-4xl py-12 space-y-16">
          <h1 className="text-4xl font-bold tracking-tight text-center">
            Resources on Anti-Semitism
          </h1>

          <section className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-primary">Educational Materials</h2>
            <ul className="list-disc pl-6">
              <li>
                <a
                  href="https://www.ushmm.org/teach/holocaust-lesson-plans/history-of-antisemitism-and-the-holocaust"
                  className="text-blue-600 hover:underline"
                >
                  History of Antisemitism and the Holocaust (USHMM)
                </a>
                <p>
                  A lesson plan exploring the history of Anti-Semitism and its role in the
                  Holocaust, encouraging critical thinking about its modern relevance.
                </p>
              </li>
              <li>
                <a
                  href="https://www.ushmm.org/teach/holocaust-lesson-plans/understanding-nazi-symbols"
                  className="text-blue-600 hover:underline"
                >
                  Understanding Nazi Symbols (USHMM)
                </a>
                <p>
                  Examines the history and meaning of the swastika, promoting critical thinking
                  about hate symbols today.
                </p>
              </li>
              <li>
                <a
                  href="https://www.myjewishlearning.com/category/study/jewish-history/anti-semitism-bigotry/"
                  className="text-blue-600 hover:underline"
                >
                  Antisemitism & Bigotry Archives (My Jewish Learning)
                </a>
                <p>
                  An "Antisemitism 101" guide detailing historical manifestations in Europe, the
                  Muslim world, and the United States.
                </p>
              </li>
              <li>
                <a
                  href="https://jewishstudies.berkeley.edu/antisemitism-education/antisemitism-antisemitism-training-film/#film"
                  className="text-blue-600 hover:underline"
                >
                  Antisemitism In our Midst; Past and Present
                </a>
                <p>
                  An 11-minute film with discussion questions charting the history and contemporary
                  forms of Anti-Semitism.
                </p>
              </li>
            </ul>
          </section>

          <section className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-primary">Guides and Definitions</h2>
            <ul className="list-disc pl-6">
              <li>
                <a href="https://antisemitism.adl.org/" className="text-blue-600 hover:underline">
                  Antisemitism Uncovered: A Guide to Old Myths in a New Era (ADL)
                </a>
                <p>
                  A comprehensive guide providing historical context, examples of Anti-Semitic
                  myths, and calls to action.
                </p>
              </li>
              <li>
                <a
                  href="https://www.ajc.org/translatehate"
                  className="text-blue-600 hover:underline"
                >
                  Translate Hate (AJC)
                </a>
                <p>
                  A guide for identifying antisemitic rhetoric in the digital age and promoting
                  positive change.
                </p>
              </li>
              <li>
                <a
                  href="https://holocaustremembrance.com/resources/working-definitions-charters/working-definition-antisemitism"
                  className="text-blue-600 hover:underline"
                >
                  IHRA Working Definition of Antisemitism
                </a>
                <p>
                  A widely recognized definition adopted by over 1,100 entities worldwide to combat
                  Anti-Semitism.
                </p>
              </li>
            </ul>
          </section>

          <section className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-primary">Reports and Statistics</h2>
            <ul className="list-disc pl-6">
              <li>
                <a
                  href="https://www.whitehouse.gov/wp-content/uploads/2023/05/U.S.-National-Strategy-to-Counter-Antisemitism.pdf"
                  className="text-blue-600 hover:underline"
                >
                  The U.S. National Strategy to Counter Antisemitism
                </a>
                <p>
                  A 2023 White House plan outlining four pillars: awareness, security,
                  normalization, and solidarity.
                </p>
              </li>
              <li>
                <a
                  href="https://www.commonwealth.virginia.gov/media/governorvirginiagov/secretary-of-the-commonwealth/pdf/Antisemitism-Commission-Report_final-(1).pdf"
                  className="text-blue-600 hover:underline"
                >
                  Combating Antisemitism in Virginia
                </a>
                <p>
                  A report with 21 recommendations to stop hatred and bigotry, with generalizable
                  insights.
                </p>
              </li>
              <li>
                <a
                  href="https://www.ajc.org/AntisemitismReport2022/AmericanJews"
                  className="text-blue-600 hover:underline"
                >
                  The State of Antisemitism in America 2022 (AJC)
                </a>
                <p>
                  A survey indicating that Jews feel less safe and are changing habits to avoid
                  identification.
                </p>
              </li>
            </ul>
          </section>

          <section className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-primary">Action and Advocacy</h2>
            <ul className="list-disc pl-6">
              <li>
                <a href="https://www.projectshema.org/" className="text-blue-600 hover:underline">
                  Project Shema
                </a>
                <p>
                  Trains communities to address contemporary Anti-Semitism, focusing on progressive
                  spaces.
                </p>
              </li>
              <li>
                <a
                  href="https://combatantisemitism.org/coalition/"
                  className="text-blue-600 hover:underline"
                >
                  Combat Antisemitism Movement (CAM) Partners
                </a>
                <p>A coalition of over 700 organizations fighting Anti-Semitism globally.</p>
              </li>
            </ul>
          </section>

          <section className="bg-card rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6 text-primary">General Resources</h2>
            <ul className="list-disc pl-6">
              <li>
                <a href="https://www.adl.org/" className="text-blue-600 hover:underline">
                  Anti-Defamation League (ADL)
                </a>
                <p>Offers resources, reports, and tools to combat Anti-Semitism and hate.</p>
              </li>
              <li>
                <a href="https://www.facinghistory.org/" className="text-blue-600 hover:underline">
                  Facing History & Ourselves
                </a>
                <p>
                  Provides educational resources to explore Anti-Semitism's historical and
                  contemporary implications.
                </p>
              </li>
              <li>
                <a
                  href="https://www.state.gov/global-guidelines-for-countering-antisemitism/"
                  className="text-blue-600 hover:underline"
                >
                  U.S. Department of State: Combating Anti-Semitism
                </a>
                <p>Reports and guidelines on global efforts to counter Anti-Semitism.</p>
              </li>
            </ul>
          </section>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Resources
