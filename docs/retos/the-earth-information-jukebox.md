excerpt: NASA’s Earth Information Center (EIC) produces stunning visualizations of our changing planet, but presenting Earth science through visualization alone limits who can reach it. We invite you to make this complex Earth science accessible, engaging, and multi-sensory by translating sight into sound. Your challenge is to build an "Earth Jukebox"—an interface, script, or application that pairs EIC visual frames with dynamic sonifications generated in real time.
skills: ['Arts & Multimedia', 'Earth Science', 'Software']
===== detailsContent
NASA’s Earth Information Center (EIC) produces stunning visualizations of our changing planet, but presenting Earth science through visualization alone limits who can reach it. We invite you to make this complex Earth science accessible, engaging, and multi-sensory by translating sight into sound. Your challenge is to build an "Earth Jukebox"—an interface, script, or application that pairs EIC visual frames with dynamic sonifications generated in real time.

### Background
NASA’s EIC provides extraordinary visualizations that track how our planet is changing, from shifting global temperatures to evolving oceanic currents. However, this vital information is predominantly presented in a visual format. This current landscape presents a significant gap: relying exclusively on sight limits accessibility for blind and low-vision users and constrains how the public can interact with complex Earth science.
Sonification—the process of translating data into sound—offers a powerful way to bridge this gap. Converting visual elements into audio unlocks multi-sensory ways to experience Earth data. Auditory processing can reveal subtle data patterns that might be missed by the naked eye and can foster a deeper emotional connection to our home planet. Participants might prioritize creating an interactive environment where the translation from sight to sound is exploratory, blending scientific data with artistic expression.
To do this, participants need a way to connect visual imagery with audio generation. You may consider building a "jukebox" interface or algorithm that analyzes EIC visual frames and plays a corresponding soundscape. Potential solutions could involve using computer vision to map color spectrums to musical chords, applying algorithms to translate pixel density into rhythm, or writing artistic rulesets that drive synthesizer parameters based on visual shapes. These are just examples, and we encourage you to develop your own creative alternatives that blend software development, data processing, and audio engineering.

### Objectives
Your challenge is to create an "Earth Jukebox" experience that generates dynamic sonifications from NASA's EIC visual frames. The desired outcome is a project where individuals can select or experience a specific EIC visualization alongside its corresponding soundscape. You may consider developing an interactive tool that actively translates the visual data into sound, or you may choose to submit a curated collection of original, generated audio files that tell the auditory story of the data.
As you build your project, you may consider exploring a variety of methods and technologies to process the visual data. You might use computer vision techniques to analyze color palettes, shapes, or pixel densities in the EIC imagery, and map those elements to audio parameters like pitch, tempo, or instrumentation. You are welcome to employ machine learning algorithms, open-source audio synthesis frameworks, or custom data-driven artistic rulesets to generate the soundscapes. The exact method of translation is entirely up to you — we encourage you to aim for soundscapes that balance data interpretation with artistic, musically pleasing outputs.
The final deliverable can take many forms to suit your team's skills. You may consider developing an interactive web-based jukebox, a standalone desktop application, a backend API endpoint, or an engaging playlist of original, generated audio files accompanied by an explanation of the creative process used to make them. Think about how your audience will experience the visual data and how your approach can best convey the complexity of our changing planet through sound. By blending software development, audio engineering, and artistic creativity, you can create a unique multi-sensory experience.

### Potential Considerations
You may (but are not required to) consider the following:
Understanding the Concepts

- Sonification: the use of non-speech audio to convey information or perceptualize data.

- Visual Frames: many EIC visualizations are animated sequences or images. You might explore extracting individual images (frames) from these sequences to serve as the foundation for your audio generation.
Designing Your "Jukebox" Experience

- Your final submission can take many forms, from a coded, interactive user interface (UI) to a thoughtfully curated digital gallery or playlist of your original, generated audio files paired with the imagery.

- If you choose to build an interactive tool, you might consider the user experience (UX) and how intuitively someone can select a visualization and initiate the audio.

- Accessibility is a core theme of this challenge. You could explore adding features that support blind and low-vision users, such as screen-reader compatibility, tactile feedback, or rich descriptive text accompanying your audio.
Approaches to Data Translation

- You might explore mapping visual elements—color spectrums, brightness, geometric shapes, or spatial pixel density—to audio parameters such as pitch, rhythm, tempo, volume, or instrumentation.

- Consider the balance between strict data translation and musicality. A direct pixel-to-sound translation might result in chaotic noise; you may want to apply artistic rulesets, musical scales, or harmonies to make the audio engaging and pleasant to listen to.

- You may explore using a variety of disciplines, from writing custom computer vision algorithms and machine learning models to utilizing audio synthesizers and digital audio workstations.
Telling the Story

- Documenting your process can help others understand your vision. You might consider sharing the "why" behind your artistic choices or explaining the algorithms and scripts you used to generate the sounds.

- Think about the emotional impact of the Earth science data. You might consider how your soundscapes can reflect the urgency of climate change or the beauty of our planet's interconnected systems.
For data and resources related to this challenge, refer to the Resources tab at the top of the page. More resources may be added before the hackathon begins.
===== resourcesTabContent
NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.

### NASA Data & Resources
Earth Information Center (EIC) Content Database (https://svs.gsfc.nasa.gov/gallery/earth-information-center/): This is a set of visuals developed by the  Scientific Visualization Studio (SVS) that is used in the EIC dashboards. Participants can use the videos and images as data for processing the audio files.
Data Sonification: Caldwell 73 (https://svs.gsfc.nasa.gov/13786/): This visualization demonstrates how NASA converts astronomical imagery into auditory experiences. Although it utilizes deep-space data, it provides an excellent conceptual framework for how visual attributes like luminosity and spatial coordinates can be effectively translated into musical volume and pitch.
Change in Night Lights between 2012 and 2023 - EIC Version (https://svs.gsfc.nasa.gov/5313/): This visual tool tracks the evolution of urban illumination across the globe. The high contrast between dark terrain and brilliant light provides a perfect testing ground for computer vision algorithms that map intensity to audio tempo or volume.
Global Sea Surface Currents and Temperature (https://svs.gsfc.nasa.gov/3912/#media_group_349716): These animations illustrate the fluid movement of ocean currents alongside thermal gradients. This is a premier for teams aiming to convert continuous, flowing motion and shifting temperature data into complex, evolving soundscapes.
GEOS Aerosols (https://svs.gsfc.nasa.gov/5669/): This visualization monitors the path of smoke, dust, and other atmospheric particles, categorized by type. It is excellently suited for multi-track experimentation, where different visual layers can be assigned unique audio textures or musical instruments.
Air Quality Model Runs (https://svs.gsfc.nasa.gov/5533/): Sourced from the Scientific Visualization Studio, these downloadable high-resolution frames represent atmospheric data models. Teams can utilize these individual images to algorithmically convert color palettes and pixel densities into dynamic sound profiles.
Perpetual Ocean 2: Western Boundary Currents (https://svs.gsfc.nasa.gov/5425/): This dataset provides striking visual maps of major oceanic boundary currents. Because the imagery is high contrast, it is extremely useful for processing via computer vision to align visual shifts with specific musical rhythms or scales.
DYAMOND Global Carbon Dioxide (https://svs.gsfc.nasa.gov/5196/): Showcasing global CO2 concentrations, this allows participants to observe changing visual patterns over time. This data can serve as a primary input for driving the interactive audio synthesis within an "Earth Jukebox" tool.
Lightning Events Detected from the ISS 2017-2023 (https://svs.gsfc.nasa.gov/5011/): This compilation of lightning data detected from space offers intricate, layered visuals. It is uniquely suited for punctuated sonification, where percussive elements or sudden audio triggers correspond to the rapid visual flashes of lightning.
A 3D View of an Atmospheric River from an Earth System Model (https://svs.gsfc.nasa.gov/4960/): This 3D visualization follows the path of an atmospheric river. Participants can extract individual frames to experiment with mapping the density and geographic spread of moisture into immersive and shifting musical landscapes.
GEDI Forest Height (https://svs.gsfc.nasa.gov/4950/): Featuring global maps of canopy elevation, this dataset is ideal for participants looking to map diverse color spectrums—which signify varying forest heights and densities—to dynamic audio parameters such as rhythm, frequency, or pitch.
categorias: Beginner/Youth, Intermediate