// Scrollytelling functionality
function initScrollytelling() {
  const steps = document.querySelectorAll('.step');
  console.log('Found steps:', steps.length);
  
  // Create Intersection Observer for steps
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const step = entry.target;
        const stepNumber = step.dataset.step;
        console.log('Step activated:', stepNumber);
        
        // Remove active class from intro steps only
        if (stepNumber && stepNumber.startsWith('intro-')) {
          const introSteps = document.querySelectorAll('.step[data-step^="intro-"]');
          introSteps.forEach(s => s.classList.remove('active'));
        } else {
          // Handle other scrollytelling sections
          const allSteps = document.querySelectorAll('.step:not([data-step^="intro-"])');
          allSteps.forEach(s => s.classList.remove('active'));
        }
        
        // Add active class to current step
        step.classList.add('active');
        
        // Trigger appropriate animation based on step
        switch(stepNumber) {
          case 'intro-1':
            animateIntroDay();
            break;
          case 'intro-2':
            animateIntroMonth();
            break;
          case 'intro-3':
            animateIntroYear();
            break;
          case '1':
            animateWasteAmount();
            break;
          case '2':
            animatePeopleFed();
            break;
          case '3':
            animateHouseholdCost();
            break;
        }
      } else {
        // Remove active class when not intersecting
        const step = entry.target;
        const stepNumber = step.dataset.step;
        if (stepNumber && stepNumber.startsWith('intro-')) {
          step.classList.remove('active');
        }
      }
    });
  }, {
    threshold: 0.5, // Trigger when 50% visible
    rootMargin: '-10% 0px -10% 0px' // Slight margin for better triggering
  });

  // Observe all steps
  steps.forEach(step => {
    observer.observe(step);
    console.log('Observing step:', step.dataset.step);
  });
}

// Animation functions for intro cards
function animateIntroDay() {
  // The day card animation is already handled by the main.js visualization
  // We can add additional effects here if needed
  console.log('Day card activated');
}

function animateIntroMonth() {
  // The month card animation is already handled by the main.js visualization
  // We can add additional effects here if needed
  console.log('Month card activated');
}

function animateIntroYear() {
  // The year card animation is already handled by the main.js visualization
  // We can add additional effects here if needed
  console.log('Year card activated');
}

// Animation functions
function animateWasteAmount() {
  const container = d3.select('#waste-animation-1');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  // Add your animation here
  // Example: Animate a number counting up to 80 million tons
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '48px')
    .text('0');
    
  const duration = 2000;
  const finalValue = 80;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)) + ' million tons');
      };
    });
}

function animatePeopleFed() {
  const container = d3.select('#waste-animation-2');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  // Add your animation here
  // Example: Animate a number counting up to 150 million people
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '48px')
    .text('0');
    
  const duration = 2000;
  const finalValue = 150;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)) + ' million people');
      };
    });
}

function animateHouseholdCost() {
  const container = d3.select('#waste-animation-3');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  // Add your animation here
  // Example: Animate a number counting up to $1,500
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '48px')
    .text('$0');
    
  const duration = 2000;
  const finalValue = 1500;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text('$' + Math.round(interpolator(t)));
      };
    });
}

// Initialize scrollytelling when the page loads
document.addEventListener('DOMContentLoaded', initScrollytelling); 