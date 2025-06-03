// Scrollytelling functionality
function initScrollytelling() {
  const steps = document.querySelectorAll('.step');
  const stickyContent = document.querySelector('.sticky-content');
  
  // Create Intersection Observer for steps
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const step = entry.target;
        const stepNumber = step.dataset.step;
        
        // Remove active class from all steps
        steps.forEach(s => s.classList.remove('active'));
        
        // Add active class to current step
        step.classList.add('active');
        
        // Trigger appropriate animation based on step
        switch(stepNumber) {
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
      }
    });
  }, {
    threshold: 0.5
  });

  // Observe all steps
  steps.forEach(step => observer.observe(step));
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