/* /js/startseite.js */
document.addEventListener('DOMContentLoaded', function() {

    // --- Animate Sections on Scroll ---
    const animatedSections = document.querySelectorAll('.animated-section');
    if (animatedSections.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        animatedSections.forEach(section => observer.observe(section));
    }

    // --- Hero Slider Logic ---
    const sliderData = [
        { title: 'KREIS-TEAM', image: 'bilder/kreis-team-hpl-granny-smith-orange_6.jpg', link:'/produkte/kreis-team/index.html' },
        { title: 'FANTAS-TISCH', image: 'bilder/fantas-tisch-5.jpg', link:'/produkte/fantas-tisch/index.html' },
        { title: 'TREE-MEETING', image: 'bilder/tree-meeting-4.jpg', link:'/produkte/tree-meeting/index.html' },
        { title: 'WERKHAUS', image: 'bilder/werkhaus-granny-smith-ral-7035.jpg', link:'/produkte/werkhaus/index.html' }
    ];

    const sliderContainer = document.getElementById('hero-slider-container');
    const navContainer = document.getElementById('slider-nav-container');

    if (sliderContainer && navContainer) {
        let currentIndex = 0;
        let isPaused = false;
        let autoPlayInterval;
        const sliderDuration = 5000; // in ms

        // Set CSS variable for transition duration
        document.documentElement.style.setProperty('--slider-duration', `${sliderDuration / 1000}s`);

        const navList = document.createElement('ul');
        navList.className = 'slider-nav-list';

        sliderData.forEach((item, index) => {
            const slide = document.createElement('div');
            slide.className = 'slider-slide';

            slide.innerHTML = `
                <div class="slide-content-wrapper">
                    <div class="slide-image-wrapper">
                        <img src="${item.image}" alt="${item.title}">
                    </div>
                    <div class="slide-title-wrapper">
                        <a href="${item.link}" class="slider-title-btn">
                            <span>${item.title}</span>
                            <span class="icon-wrapper"><i class="fas fa-arrow-right"></i></span>
                        </a>
                    </div>
                </div>`;
            sliderContainer.appendChild(slide);

            const navItem = document.createElement('li');
            navItem.className = 'slider-nav-item';
            navItem.dataset.index = index;
            navItem.innerHTML = `<span class="slider-nav-number">${String(index + 1).padStart(2, '0')}</span><div class="slider-nav-progress"><div class="slider-nav-progress-bar"></div></div>`;
            navList.appendChild(navItem);
        });

        const pauseBtn = document.createElement('button');
        pauseBtn.className = 'slider-pause-btn';
        pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'slider-controls';
        controlsDiv.appendChild(pauseBtn);

        navContainer.appendChild(navList);
        navContainer.appendChild(controlsDiv);

        const slides = sliderContainer.querySelectorAll('.slider-slide');
        const navItems = navContainer.querySelectorAll('.slider-nav-item');

        function adjustContainerHeight() {
            if (window.innerWidth <= 992) {
                const activeImage = slides[currentIndex].querySelector('img');
                if (activeImage && activeImage.complete) {
                    sliderContainer.style.height = `${activeImage.offsetHeight}px`;
                } else if (activeImage) {
                    activeImage.onload = () => { sliderContainer.style.height = `${activeImage.offsetHeight}px`; };
                }
            } else {
                sliderContainer.style.height = '';
            }
        }

        function goToSlide(index) {
            currentIndex = index;
            slides.forEach(s => s.classList.remove('is-active'));
            navItems.forEach(n => n.classList.remove('is-active', 'is-running'));

            slides[currentIndex].classList.add('is-active');
            navItems[currentIndex].classList.add('is-active');

            adjustContainerHeight();

            const progressBar = navItems[currentIndex].querySelector('.slider-nav-progress-bar');
            progressBar.style.transition = 'none';
            progressBar.style.transform = 'scaleY(0)';
            void progressBar.offsetWidth;

            if (!isPaused) {
                navItems[currentIndex].classList.add('is-running');
            }
        }

        function nextSlide() { goToSlide((currentIndex + 1) % sliderData.length); }

        function startAutoplay() {
            isPaused = false;
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            goToSlide(currentIndex);
            autoPlayInterval = setInterval(nextSlide, sliderDuration);
        }

        function stopAutoplay(manualClick = true) {
            if (manualClick) { isPaused = true; pauseBtn.innerHTML = '<i class="fas fa-play"></i>'; }
            navItems.forEach(n => n.classList.remove('is-running'));
            clearInterval(autoPlayInterval);
        }

        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const newIndex = parseInt(item.dataset.index);
                if (newIndex !== currentIndex) {
                    stopAutoplay();
                    goToSlide(newIndex);
                    if(!isPaused) {
                        autoPlayInterval = setInterval(nextSlide, sliderDuration);
                    }
                }
            });
        });

        pauseBtn.addEventListener('click', () => { isPaused ? startAutoplay() : stopAutoplay(); });
        sliderContainer.addEventListener('mouseenter', () => { if (!isPaused) stopAutoplay(false); });
        sliderContainer.addEventListener('mouseleave', () => { if (!isPaused) startAutoplay(); });
        window.addEventListener('resize', adjustContainerHeight);

        startAutoplay();
    }
});
