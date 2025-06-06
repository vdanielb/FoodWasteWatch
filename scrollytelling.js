// Scrollytelling functionality
function initScrollytelling() {
  const steps = document.querySelectorAll('.step');
  console.log('Found steps:', steps.length);
  
  // Create Intersection Observer for steps (excluding intro steps which are now handled by layered scrolling)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const step = entry.target;
        const stepNumber = step.dataset.step;
        console.log('Step activated:', stepNumber);
        
        // Skip intro steps as they're handled by the new layered scrolling system
        if (stepNumber && stepNumber.startsWith('intro-')) {
          return;
        }
        
        // Handle other scrollytelling sections
        const allSteps = document.querySelectorAll('.step:not([data-step^="intro-"])');
        allSteps.forEach(s => s.classList.remove('active'));
        
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
          case '4':
            animateClimateImpact();
            break;
          case '5':
            animateWaterFootprint();
            break;
          case '6':
            animateLandFootprint();
            break;
          case '7':
            animateHungerOffset();
            break;
          case '8':
            animatePersonalSavings();
            break;
          case '9':
            animateMethaneReduction();
            break;
          case '10':
            animateJobCreation();
            break;
          case '11':
            initCausesChart();
            break;
          case '12':
            initEffectsChart();
            break;
          case '13':
            initSolutionsChart();
            break;
          case '14':
            initImpactChart();
            break;
        }
      }
    });
  }, {
    threshold: 0.5, // Trigger when 50% visible
    rootMargin: '-10% 0px -10% 0px' // Slight margin for better triggering
  });

  // Observe all non-intro steps
  steps.forEach(step => {
    if (!step.dataset.step || !step.dataset.step.startsWith('intro-')) {
      observer.observe(step);
      console.log('Observing step:', step.dataset.step);
    }
  });
}

// Animation functions
function animateWasteAmount() {
  const container = d3.select('#waste-animation-1');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 500 300');
  
  // Create pile of food waste with animated growth
  const foodItems = ['🍎', '🥖', '🥕', '🧀', '🍌', '🥬', '🍅', '🥯', '🥞', '🍋'];
  const finalValue = 75;
  
  // Background circle for context
  svg.append('circle')
    .attr('cx', 250)
    .attr('cy', 150)
    .attr('r', 0)
    .attr('fill', 'rgba(231, 76, 60, 0.1)')
    .attr('stroke', '#e74c3c')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5')
    .transition()
    .duration(1500)
    .attr('r', 120);
  
  // Animated counter in center
  const counterText = svg.append('text')
    .attr('x', 250)
    .attr('y', 150)
    .attr('text-anchor', 'middle')
    .attr('font-size', '36px')
    .attr('font-weight', 'bold')
    .attr('fill', '#e74c3c')
    .text('0');
  
  // Add unit text
  svg.append('text')
    .attr('x', 250)
    .attr('y', 180)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .attr('fill', '#7f8c8d')
    .text('million tons annually');
  
  // Animate food items falling around the circle
  foodItems.forEach((food, i) => {
    const angle = (i / foodItems.length) * 2 * Math.PI;
    const radius = 100;
    const x = 250 + Math.cos(angle) * radius;
    const y = 150 + Math.sin(angle) * radius;
    
    svg.append('text')
      .attr('x', x)
      .attr('y', 50)
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .style('opacity', 0)
      .text(food)
      .transition()
      .delay(i * 100 + 500)
      .duration(800)
      .attr('y', y)
      .style('opacity', 1)
      .ease(d3.easeBounceOut);
  });
  
  // Animate the counter
  counterText
    .transition()
    .delay(800)
    .duration(2000)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)));
      };
    });
}

function animatePeopleFed() {
  const container = d3.select('#waste-animation-2');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 500 300');
  
  // Create stacked Empire State Buildings animation
  const buildingWidth = 30;
  const buildingHeight = 120;
  const buildingsPerRow = 12;
  const totalBuildings = 450;
  const rows = Math.ceil(totalBuildings / buildingsPerRow);
  
  // Draw cityscape background
  svg.append('rect')
    .attr('x', 0)
    .attr('y', 200)
    .attr('width', 500)
    .attr('height', 100)
    .attr('fill', '#34495e')
    .attr('opacity', 0.1);
  
  // Add title
  svg.append('text')
    .attr('x', 250)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text('🏢 Empire State Building × 450');
  
  // Create building animation
  let buildingCount = 0;
  const animateBuildings = () => {
    const row = Math.floor(buildingCount / buildingsPerRow);
    const col = buildingCount % buildingsPerRow;
    const x = 40 + col * (buildingWidth + 5);
    const y = 180 - row * 25;
    
    if (buildingCount < totalBuildings && row < 6) { // Limit visible buildings
      svg.append('rect')
        .attr('x', x)
        .attr('y', y + buildingHeight)
        .attr('width', buildingWidth)
        .attr('height', 0)
        .attr('fill', row === 0 ? '#3498db' : '#95a5a6')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 1)
        .transition()
        .duration(50)
        .attr('y', y)
        .attr('height', buildingHeight / (row + 1));
      
      buildingCount++;
      if (buildingCount <= 50) { // Animate first 50 buildings individually
        setTimeout(animateBuildings, 80);
      }
    }
  };
  
  // Counter for buildings
  const counter = svg.append('text')
    .attr('x', 250)
    .attr('y', 270)
    .attr('text-anchor', 'middle')
    .attr('font-size', '24px')
    .attr('font-weight', 'bold')
    .attr('fill', '#e74c3c')
    .text('0 buildings');
  
  setTimeout(() => {
    animateBuildings();
    
    // Animate counter
    counter
      .transition()
      .duration(4000)
      .tween('text', function() {
        const interpolator = d3.interpolateNumber(0, 450);
        return function(t) {
          d3.select(this).text(Math.round(interpolator(t)) + ' buildings');
        };
      });
  }, 500);
}

function animateHouseholdCost() {
  const container = d3.select('#waste-animation-3');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 500 300');
  
  // Create money/value visualization
  const totalValue = 440; // billion
  const householdValue = 1400;
  
  // Create dollar bills animation
  const billWidth = 40;
  const billHeight = 20;
  const billsPerRow = 10;
  
  // Background for total value
  svg.append('text')
    .attr('x', 250)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .attr('font-size', '20px')
    .attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text('💰 Total Economic Impact');
  
  // Total value counter
  const totalCounter = svg.append('text')
    .attr('x', 250)
    .attr('y', 70)
    .attr('text-anchor', 'middle')
    .attr('font-size', '32px')
    .attr('font-weight', 'bold')
    .attr('fill', '#e74c3c')
    .text('$0');
  
  svg.append('text')
    .attr('x', 250)
    .attr('y', 90)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('fill', '#7f8c8d')
    .text('billion annually');
  
  // Household section
  svg.append('line')
    .attr('x1', 50)
    .attr('x2', 450)
    .attr('y1', 120)
    .attr('y2', 120)
    .attr('stroke', '#bdc3c7')
    .attr('stroke-width', 2);
  
  svg.append('text')
    .attr('x', 250)
    .attr('y', 150)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text('🏠 Average Per Household');
  
  // Household value counter
  const householdCounter = svg.append('text')
    .attr('x', 250)
    .attr('y', 180)
    .attr('text-anchor', 'middle')
    .attr('font-size', '28px')
    .attr('font-weight', 'bold')
    .attr('fill', '#27ae60')
    .text('$0');
  
  svg.append('text')
    .attr('x', 250)
    .attr('y', 200)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('fill', '#7f8c8d')
    .text('per year');
  
  // Animate dollar signs floating
  const dollarSigns = ['💵', '💴', '💶', '💷'];
  dollarSigns.forEach((sign, i) => {
    svg.append('text')
      .attr('x', 80 + i * 90)
      .attr('y', 250)
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .style('opacity', 0)
      .text(sign)
      .transition()
      .delay(i * 200)
      .duration(1000)
      .style('opacity', 1)
      .attr('y', 230)
      .ease(d3.easeBounceOut);
  });
  
  // Animate counters
  setTimeout(() => {
    totalCounter
      .transition()
      .duration(2500)
      .tween('text', function() {
        const interpolator = d3.interpolateNumber(0, totalValue);
        return function(t) {
          d3.select(this).text('$' + Math.round(interpolator(t)));
        };
      });
    
    householdCounter
      .transition()
      .delay(500)
      .duration(2000)
      .tween('text', function() {
        const interpolator = d3.interpolateNumber(0, householdValue);
        return function(t) {
          d3.select(this).text('$' + Math.round(interpolator(t)).toLocaleString());
        };
      });
  }, 800);
}

function animateClimateImpact() {
  const container = d3.select('#waste-animation-4');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 500 300');
  
  // Create CO2 and car visualization
  const finalValue = 58;
  
  // Background for atmosphere effect
  svg.append('circle')
    .attr('cx', 250)
    .attr('cy', 150)
    .attr('r', 0)
    .attr('fill', 'rgba(231, 76, 60, 0.05)')
    .attr('stroke', '#e74c3c')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '10,5')
    .transition()
    .duration(2000)
    .attr('r', 140);
  
  // Title
  svg.append('text')
    .attr('x', 250)
    .attr('y', 40)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text('🚗 Climate Impact Equivalent');
  
  // Create animated cars
  const carPositions = [
    {x: 100, y: 120}, {x: 150, y: 140}, {x: 200, y: 110},
    {x: 300, y: 130}, {x: 350, y: 150}, {x: 400, y: 120},
    {x: 120, y: 180}, {x: 180, y: 200}, {x: 280, y: 190},
    {x: 330, y: 170}, {x: 380, y: 200}
  ];
  
  // Animate cars appearing
  carPositions.forEach((pos, i) => {
    svg.append('text')
      .attr('x', pos.x)
      .attr('y', pos.y + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .style('opacity', 0)
      .text('🚗')
      .transition()
      .delay(i * 150 + 500)
      .duration(600)
      .style('opacity', 1)
      .attr('y', pos.y)
      .ease(d3.easeBounceOut);
  });
  
  // CO2 molecules floating up
  const co2Positions = [
    {x: 80, y: 100}, {x: 140, y: 80}, {x: 220, y: 90},
    {x: 280, y: 85}, {x: 360, y: 95}, {x: 420, y: 105}
  ];
  
  co2Positions.forEach((pos, i) => {
    const co2 = svg.append('text')
      .attr('x', pos.x)
      .attr('y', pos.y + 100)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .style('opacity', 0)
      .attr('fill', '#95a5a6')
      .text('CO₂');
    
    // Animate CO2 rising
    co2.transition()
      .delay(i * 200 + 1000)
      .duration(1500)
      .style('opacity', 0.7)
      .attr('y', pos.y)
      .ease(d3.easeQuadOut)
      .transition()
      .duration(1000)
      .style('opacity', 0)
      .attr('y', pos.y - 30);
  });
  
  // Main counter
  const counter = svg.append('text')
    .attr('x', 250)
    .attr('y', 250)
    .attr('text-anchor', 'middle')
    .attr('font-size', '28px')
    .attr('font-weight', 'bold')
    .attr('fill', '#e74c3c')
    .text('0 million cars');
  
  // Animate counter
  setTimeout(() => {
    counter
      .transition()
      .duration(2500)
      .tween('text', function() {
        const interpolator = d3.interpolateNumber(0, finalValue);
        return function(t) {
          d3.select(this).text(Math.round(interpolator(t)) + ' million cars equivalent');
        };
      });
  }, 1200);
}

function animateWaterFootprint() {
  const container = d3.select('#waste-animation-5');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 500 300');
  
  // Create water drop and pool visualization
  const finalValue = 21;
  const poolsValue = 2.3;
  
  // Title
  svg.append('text')
    .attr('x', 250)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text('🌊 Water Resources Wasted');
  
  // Create animated water pool
  const poolWidth = 300;
  const poolHeight = 80;
  
  // Pool container
  svg.append('ellipse')
    .attr('cx', 250)
    .attr('cy', 180)
    .attr('rx', poolWidth/2)
    .attr('ry', poolHeight/2)
    .attr('fill', 'none')
    .attr('stroke', '#3498db')
    .attr('stroke-width', 3)
    .attr('opacity', 0)
    .transition()
    .duration(1000)
    .attr('opacity', 1);
  
  // Water filling animation
  svg.append('ellipse')
    .attr('cx', 250)
    .attr('cy', 180)
    .attr('rx', 0)
    .attr('ry', 0)
    .attr('fill', '#3498db')
    .attr('opacity', 0.6)
    .transition()
    .delay(500)
    .duration(2000)
    .attr('rx', poolWidth/2 - 5)
    .attr('ry', poolHeight/2 - 5);
  
  // Animated water drops falling
  const dropPositions = [
    {x: 120, delay: 0}, {x: 180, delay: 200}, {x: 240, delay: 400},
    {x: 300, delay: 600}, {x: 360, delay: 800}
  ];
  
  dropPositions.forEach(drop => {
    const waterDrop = svg.append('text')
      .attr('x', drop.x)
      .attr('y', 60)
      .attr('text-anchor', 'middle')
      .attr('font-size', '20px')
      .style('opacity', 0)
      .text('💧');
    
    // Animate drop falling
    waterDrop.transition()
      .delay(drop.delay)
      .duration(800)
      .style('opacity', 1)
      .attr('y', 140)
      .ease(d3.easeQuadIn)
      .transition()
      .duration(200)
      .style('opacity', 0);
  });
  
  // Swimming pool icons
  const poolIcons = ['🏊‍♀️', '🏊‍♂️', '🏊', '🤽‍♀️'];
  poolIcons.forEach((icon, i) => {
    svg.append('text')
      .attr('x', 150 + i * 50)
      .attr('y', 180)
      .attr('text-anchor', 'middle')
      .attr('font-size', '16px')
      .style('opacity', 0)
      .text(icon)
      .transition()
      .delay(1500 + i * 200)
      .duration(600)
      .style('opacity', 1);
  });
  
  // Main counter for gallons
  const gallonsCounter = svg.append('text')
    .attr('x', 250)
    .attr('y', 240)
    .attr('text-anchor', 'middle')
    .attr('font-size', '24px')
    .attr('font-weight', 'bold')
    .attr('fill', '#3498db')
    .text('0 trillion gallons');
  
  // Olympic pools counter
  const poolsCounter = svg.append('text')
    .attr('x', 250)
    .attr('y', 265)
    .attr('text-anchor', 'middle')
    .attr('font-size', '16px')
    .attr('fill', '#7f8c8d')
    .text('0 Olympic pools');
  
  // Animate counters
  setTimeout(() => {
    gallonsCounter
      .transition()
      .duration(2500)
      .tween('text', function() {
        const interpolator = d3.interpolateNumber(0, finalValue);
        return function(t) {
          d3.select(this).text(Math.round(interpolator(t)) + ' trillion gallons');
        };
      });
    
    poolsCounter
      .transition()
      .delay(500)
      .duration(2000)
      .tween('text', function() {
        const interpolator = d3.interpolateNumber(0, poolsValue);
        return function(t) {
          d3.select(this).text(interpolator(t).toFixed(1) + ' million Olympic pools');
        };
      });
  }, 1000);
}

function animateLandFootprint() {
  const container = d3.select('#waste-animation-6');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '36px')
    .text('0 million acres');
    
  const duration = 2000;
  const finalValue = 56;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)) + ' million acres');
      };
    });
}

function animateHungerOffset() {
  const container = d3.select('#waste-animation-7');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '36px')
    .text('0 million Americans');
    
  const duration = 2000;
  const finalValue = 13;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)) + ' million Americans');
      };
    });
}

function animatePersonalSavings() {
  const container = d3.select('#waste-animation-8');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '48px')
    .text('$0');
    
  const duration = 2000;
  const finalValue = 700;
  
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

function animateMethaneReduction() {
  const container = d3.select('#waste-animation-9');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '48px')
    .text('0%');
    
  const duration = 2000;
  const finalValue = 34;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)) + '%');
      };
    });
}

function animateJobCreation() {
  const container = d3.select('#waste-animation-10');
  container.selectAll('*').remove();
  
  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', '0 0 400 300');
    
  const text = svg.append('text')
    .attr('x', '50%')
    .attr('y', '50%')
    .attr('text-anchor', 'middle')
    .attr('font-size', '36px')
    .text('0 jobs');
    
  const duration = 2000;
  const finalValue = 51000;
  
  d3.select(text.node())
    .transition()
    .duration(duration)
    .tween('text', function() {
      const interpolator = d3.interpolateNumber(0, finalValue);
      return function(t) {
        d3.select(this).text(Math.round(interpolator(t)).toLocaleString() + ' jobs');
      };
    });
}

// Dashboard Animation Functions
function initializeDashboard() {
  // Animate stat cards on load
  const statCards = document.querySelectorAll('.stat-card');
  statCards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    
    setTimeout(() => {
      card.style.transition = 'all 0.6s ease';
      card.style.opacity = '1';
      card.style.transform = 'translateY(0px)';
    }, index * 200);
  });
  
  // Initialize dashboard animations
  animateDashboardStats();
  setupImpactVisuals();
  animateSolutionCards();
}

function animateDashboardStats() {
  // Animate core statistics
  animateStatNumber('stat-tons-dash', 75, 'M', 2000);
  animateStatNumber('stat-value-dash', 440, 'B', 2500);
  animateStatNumber('stat-esb-dash', 450, 'x', 2200);
  
  // Add floating animations to stat cards
  const primaryCard = document.querySelector('.stat-card.primary');
  const economicCard = document.querySelector('.stat-card.economic');
  const comparisonCard = document.querySelector('.stat-card.comparison');
  
  if (primaryCard) createFloatingAnimation(primaryCard);
  if (economicCard) createFloatingAnimation(economicCard);
  if (comparisonCard) createFloatingAnimation(comparisonCard);
}

function animateStatNumber(elementId, targetValue, suffix, duration) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  let currentValue = 0;
  const increment = targetValue / (duration / 50);
  
  const timer = setInterval(() => {
    currentValue += increment;
    if (currentValue >= targetValue) {
      currentValue = targetValue;
      clearInterval(timer);
    }
    element.textContent = Math.round(currentValue) + suffix;
  }, 50);
}

function setupImpactVisuals() {
  // Climate impact visual
  const climateVisual = document.getElementById('climate-visual');
  if (climateVisual) {
    climateVisual.innerHTML = createFloatingEmojis(['🚗', '💨', '☁️'], 3);
  }
  
  // Water impact visual
  const waterVisual = document.getElementById('water-visual');
  if (waterVisual) {
    waterVisual.innerHTML = createFloatingEmojis(['🌊', '🏊‍♂️', '🏊‍♀️'], 3);
  }
  
  // Land impact visual
  const landVisual = document.getElementById('land-visual');
  if (landVisual) {
    landVisual.innerHTML = createFloatingEmojis(['🚜', '🌾', '🏞️'], 3);
  }
}

function createFloatingEmojis(emojis, count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    const emoji = emojis[i % emojis.length];
    const delay = i * 0.5;
    html += `<span style="
      position: absolute;
      font-size: 1.2rem;
      animation: float 3s ease-in-out infinite;
      animation-delay: ${delay}s;
      top: ${Math.random() * 40 + 20}%;
      left: ${Math.random() * 40 + 30}%;
    ">${emoji}</span>`;
  }
  return html;
}

function animateSolutionCards() {
  const solutionCards = document.querySelectorAll('.solution-card');
  
  // Intersection Observer for solution cards
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'slideInUp 0.6s ease forwards';
      }
    });
  }, { threshold: 0.3 });
  
  solutionCards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
  });
}

function createFloatingAnimation(element) {
  if (!element) return;
  
  element.style.animation = 'gentleFloat 4s ease-in-out infinite';
  
  // Add keyframes if not already present
  if (!document.querySelector('#floating-keyframes')) {
    const style = document.createElement('style');
    style.id = 'floating-keyframes';
    style.textContent = `
      @keyframes gentleFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
      }
      
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }
      
      @keyframes slideInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0px);
        }
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize scrollytelling when the page loads
document.addEventListener('DOMContentLoaded', initScrollytelling);

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
  // ... existing code ...
  
  // Initialize dashboard if present
  if (document.querySelector('.stats-dashboard')) {
    setTimeout(initializeDashboard, 500);
  }
}); 