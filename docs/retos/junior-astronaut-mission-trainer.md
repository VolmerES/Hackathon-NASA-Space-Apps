excerpt: Space-themed STEM content often oversimplifies the engineering trade-offs that define a real mission or presents them at a level too complex to hold a young learner's attention. Few tools make those trade-offs both tangible and fun. Your challenge is to design and build an interactive game or app that lets students run a lunar or Martian outpost, balancing competing demands like life support, radiation shielding, power, and food production, so they experience firsthand the decisions that determine whether a mission fails or succeeds.
skills: ['Games', 'Planets & Moons', 'Software', 'Space Exploration', 'Sun']
===== detailsContent
Space-themed STEM content often oversimplifies the engineering trade-offs that define a real mission or presents them at a level too complex to hold a young learner's attention. Few tools make those trade-offs both tangible and fun. Your challenge is to design and build an interactive game or app that lets students run a lunar or Martian outpost, balancing competing demands like life support, radiation shielding, power, and food production, so they experience firsthand the decisions that determine whether a mission fails or succeeds.

### Background
As NASA works to establish a sustained presence on the Moon and extend human exploration toward Mars, one of the most persistent challenges isn't just engineering hardware — it's building public understanding of what survival actually requires in these environments. Astronauts on a lunar or Martian outpost must balance competing demands: limited power has to be split between life support, communications, and science; radiation exposure has to be weighed against mission objectives; and every decision carries a resource cost that compounds over time. These are the same kinds of trade-offs NASA's own mission planners navigate daily, informed by real data — solar activity and radiation risk from the Space Weather Database (DONKI), astronaut radiation dosimetry and biological research from the Open Science Data Repository (OSDR), and environmental data from Artemis and Mars surface missions.
The gap is in translation. Space education content for kids often stays too abstract (e.g., posters and general facts) to convey real trade-offs or assumes a technical background too advanced for a young audience to engage with meaningfully. As a result, many students never encounter the actual decision-making logic behind a mission—only its outcomes. Content that leans purely educational often struggles to hold attention; content that leans purely toward entertainment can lose accuracy.
Participants might prioritize designing mechanics—not just visuals—that mirror real constraints: a choice that saves power today might cost oxygen tomorrow. Grounding gameplay in real NASA open data, rather than invented statistics, is encouraged. Possible approaches include survival-style resource management, narrative decision trees, or dashboard-style mission control simulators—but participants are encouraged to explore whatever format best teaches the underlying trade-off rather than conforming to any single template.

### Objectives
Your challenge is to design and build an interactive game or app that lets kids ages 7–12 manage a lunar or Martian outpost, making real decisions about life support, radiation shielding, power budgeting, food production, and communication delay, and experiencing how those choices play out over the course of a simulated mission.
Think about how your tool can turn genuine mission constraints into gameplay: what does it feel like to trade oxygen reserves for an extra research opportunity, or to reinforce shielding against a radiation event at the cost of tonight's power supply? How will you represent competing resources so that no choice is free, and every decision teaches something true about what astronauts and mission planners actually navigate?
You're encouraged to ground your simulation in real NASA open data wherever possible — for example, using DONKI to reflect actual solar activity and radiation risk, the OSDR for real astronaut health and biological research findings, or Artemis and Mars surface mission data to inform environmental conditions at your chosen site. Incorporating live or archived NASA datasets, rather than fabricated numbers, will make the experience more authentic and give players a genuine window into how mission-critical decisions are made.
Format is open: you could build a resource-management survival game, a narrative-driven decision simulator, a mission-control-style dashboard experience, or something else entirely — browser-based, mobile, or desktop. The goal is a working prototype that demonstrates the trade-off mechanic clearly enough that a young player walks away understanding a real constraint of deep space survival, not just having played a fun game. Creative interpretations of "outpost," "site," or "mission" beyond the Moon and Mars are welcome, provided the underlying educational goal — teaching real engineering trade-offs through play — stays central.

### Potential Considerations
You may (but are not required to) consider the following:
Audience and Accessibility

- Your target audience is kids ages 7–12, but consider whether your tool can flex to engage older siblings, parents, or classroom settings too.

- Favor plain language over jargon; where a scientific term is unavoidable — radiation dose, microgravity, sol — briefly explain it in-context rather than assuming prior knowledge.

- Low barrier to entry matters — a browser-playable experience with no download or account required will reach more participants during judging and more students afterward.
Grounding in Real Data

- Wherever possible, pull from NASA's public APIs and open datasets rather than inventing plausible-sounding numbers—even a small amount of real data—a real radiation reading, a real Mars photo, a real astronaut health finding—makes the experience meaningfully more credible than an entirely simulated one.

- Clearly attribute your data sources within the tool itself, so players understand they're engaging with real NASA science, not just a themed game.

- If live API calls aren't feasible during your build window, a curated real dataset embedded directly into your tool is a reasonable and honest alternative—just don't present static data as live.
Gameplay and Design Pitfalls to Avoid

- Avoid designing a "safe" choice that has no cost—the educational value comes from every decision involving a genuine trade-off, mirroring real mission planning.

- Don't let visual polish substitute for mechanical accuracy—a simple game that teaches a real constraint beats a beautiful one that doesn't.

- Avoid overwhelming young players with too many simultaneous systems to track; two or three core resources—life support, power, shielding—are usually more effective than five or six.
What Would Make a Solution Stand Out

- Tools that let players see the real-world consequences of their in-game choice—linking a radiation-shielding decision to actual current space weather data.

- Replayability—mechanics or events that vary between playthroughs encourage kids to try different strategies and learn from failure without it feeling punitive.

- Accompanying a working prototype with a short explanation of which NASA datasets were used and why, making the science traceable and verifiable by judges.
For data and resources related to this challenge, refer to the Resources tab at the top of the page. More resources may be added before the hackathon begins.
===== resourcesTabContent
NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.

### NASA Data & Resources
NASA Open APIs (https://api.nasa.gov/): NASA's central public API portal, providing free programmatic access to datasets including the Astronomy Picture of the Day (APOD), Mars Rover Photos, and the Space Weather Database (DONKI). A free API key (higher rate limits than the shared demo key) can be requested instantly and is a good starting point for any challenge team building a data-connected prototype.
Space Weather Database Of Notifications, Knowledge, Information (DONKI) (https://ccmc.gsfc.nasa.gov/tools/DONKI/): Real, regularly updated data on solar flares, coronal mass ejections, and other space weather events that drive radiation risk for astronauts and spacecraft. Useful for grounding any radiation-shielding, communications-disruption, or mission-risk mechanic in actual current conditions rather than invented numbers.
NASA Open Science Data Repository (OSDR) (https://osdr.nasa.gov/bio/repo/): (search API (https://osdr.nasa.gov/osdr/data/search?term=KEYWORD)) NASA's public archive of space biology and astronaut health research, including studies on how spaceflight affects bone density, muscle mass, immune response, sleep, and more across many organisms. Searchable by keyword, making it well suited for tools that want to surface real published NASA science relevant to human health trade-offs in space.
RadLab (OSDR Radiation Dosimetry Database) (https://visualization.osdr.nasa.gov/radlab/gui/data-api/): Real radiation dose measurements recorded by dosimetry instruments aboard the International Space Station, contributed by multiple international space agencies. Provides authentic astronaut radiation exposure data (e.g., absorbed dose rate) useful for any tool modeling shielding, health risk, or long-duration mission trade-offs.
Mars Trek (https://trek.nasa.gov/mars/): An interactive visualization and data-download portal for real Mars surface imagery, elevation, and terrain data compiled from NASA's Mars missions (including Curiosity and Perseverance). Useful for teams wanting real environmental or geographic data to ground a Mars outpost site or terrain visualization in actual surface conditions.

### Space Agency Partner Resources
CSA (Canadian Space Agency)
Space resources for STEM and youth organizations (https://www.asc-csa.gc.ca/eng/youth-educators/resources-stem-and-youth-organizations.asp): The CSA's Space Resources for STEM and Youth Organizations page provides free, bilingual tools and activities to help educators engage youth in space and STEM. Designed for museums, libraries, camps, after-school clubs, community groups, and outreach organizations, these resources support learning beyond the classroom.
Food production on the moon and in remote areas (https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/): This web package is a one-stop resource for educators and youth who want to learn about food in space. This toolkit aims to outline how food production in space can relate to the health and nutrition of astronauts as well as benefit humans on Earth.
categorias: Beginner/Youth, Intermediate