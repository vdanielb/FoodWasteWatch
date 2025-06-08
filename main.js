// Global data cache to avoid redundant loading
let globalWasteData = null;
let globalTopoData = null;

// Shared constants to avoid duplication
const STATE_POPULATION_2023 = {
  "Alabama": 5074296, "Alaska": 733406, "Arizona": 7359191, "Arkansas": 3045637, "California": 38918045,
  "Colorado": 5912064, "Connecticut": 3605944, "Delaware": 1045631, "District of Columbia": 678972, "Florida": 22377446,
  "Georgia": 11015963, "Hawaii": 1427539, "Idaho": 1942571, "Illinois": 12582032, "Indiana": 6842384,
  "Iowa": 3205690, "Kansas": 2934582, "Kentucky": 4546607, "Louisiana": 4569031, "Maine": 1396966,
  "Maryland": 6195295, "Massachusetts": 6981974, "Michigan": 10061863, "Minnesota": 5737914, "Mississippi": 2918320,
  "Missouri": 6168187, "Montana": 1103349, "Nebraska": 1961504, "Nevada": 3235251, "New Hampshire": 1388992,
  "New Jersey": 9261692, "New Mexico": 2115252, "New York": 19453561, "North Carolina": 10701022, "North Dakota": 779261,
  "Ohio": 11780017, "Oklahoma": 4019800, "Oregon": 4237256, "Pennsylvania": 12801989, "Rhode Island": 1097379,
  "South Carolina": 5321610, "South Dakota": 909824, "Tennessee": 7092654, "Texas": 30439188, "Utah": 3402027,
  "Vermont": 647156, "Virginia": 8683619, "Washington": 7715946, "West Virginia": 1778070, "Wisconsin": 5893718,
  "Wyoming": 586485
};

const STATE_ID_TO_NAME = new Map([
  ["01", "Alabama"], ["02", "Alaska"], ["04", "Arizona"], ["05", "Arkansas"], ["06", "California"],
  ["08", "Colorado"], ["09", "Connecticut"], ["10", "Delaware"], ["11", "District of Columbia"], ["12", "Florida"],
  ["13", "Georgia"], ["15", "Hawaii"], ["16", "Idaho"], ["17", "Illinois"], ["18", "Indiana"],
  ["19", "Iowa"], ["20", "Kansas"], ["21", "Kentucky"], ["22", "Louisiana"], ["23", "Maine"],
  ["24", "Maryland"], ["25", "Massachusetts"], ["26", "Michigan"], ["27", "Minnesota"], ["28", "Mississippi"],
  ["29", "Missouri"], ["30", "Montana"], ["31", "Nebraska"], ["32", "Nevada"], ["33", "New Hampshire"],
  ["34", "New Jersey"], ["35", "New Mexico"], ["36", "New York"], ["37", "North Carolina"], ["38", "North Dakota"],
  ["39", "Ohio"], ["40", "Oklahoma"], ["41", "Oregon"], ["42", "Pennsylvania"], ["44", "Rhode Island"],
  ["45", "South Carolina"], ["46", "South Dakota"], ["47", "Tennessee"], ["48", "Texas"], ["49", "Utah"],
  ["50", "Vermont"], ["51", "Virginia"], ["53", "Washington"], ["54", "West Virginia"], ["55", "Wisconsin"],
  ["56", "Wyoming"]
]);

// Efficient data loading function
async function loadGlobalData() {
  if (!globalWasteData) {
    globalWasteData = await d3.csv('data/wastebyyear.csv', d => {
      d.year = +d.year;
      d.tons_waste = +d.tons_waste;
      return d;
    });
  }
  if (!globalTopoData) {
    const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
    globalTopoData = await d3.json(geoUrl);
  }
  return { wasteData: globalWasteData, topoData: globalTopoData };
}

// Global variable to track current view mode
let currentViewMode = 'per10k';

// Year slider event handler with performance improvements
const yearSlider = document.getElementById('year-slider');
const yearSliderValue = document.getElementById('year-slider-value');
const viewModeSelect = document.getElementById('view-mode');

if (yearSlider && yearSliderValue) {
  let debounceTimer = null;
  
  yearSlider.addEventListener('input', function() {
    const year = +this.value;
    yearSliderValue.textContent = year;
    
    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Increment operation ID to cancel previous operations
    currentOperationId++;
    const operationId = currentOperationId;
    
    // Debounce the actual drawing operations by 150ms
    debounceTimer = setTimeout(() => {
      // Check if this operation is still current
      if (operationId === currentOperationId) {
        // Redraw map and plots for selected year and state
        drawFoodWasteMap(year, operationId);
        drawFoodWasteBySubSectorBar({ year, state: selectedState || '', operationId });
        drawFoodWasteByFoodTypeBar({ year, state: selectedState || '', operationId });
      }
    }, 150);
  });
}

// Add view mode change handler
if (viewModeSelect) {
  viewModeSelect.addEventListener('change', function() {
    currentViewMode = this.value;
    const year = yearSlider ? +yearSlider.value : 2023;
    currentOperationId++;
    drawFoodWasteMap(year, currentOperationId);
  });
}

async function drawFoodWasteMap(year, operationId = null) {
  const { wasteData, topoData } = await loadGlobalData();
  
  // Check if operation was cancelled
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  const dataYear = wasteData.filter(d => d.year === year);

  // Aggregate tons_waste by state (per 10,000 people or total) using shared constant
  const wasteByState = d3.rollup(
    dataYear,
    v => {
      const state = v[0].state;
      const pop = STATE_POPULATION_2023[state];
      if (!pop) return null;
      const totalWaste = d3.sum(v, d => d.tons_waste);
      return {
        per10k: totalWaste / (pop / 10000),
        totalWaste: totalWaste
      };
    },
    d => d.state
  );

  // Check if operation was cancelled before DOM updates
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }

  // Map state names to postal codes for GeoJSON
  const width = 960, height = 500;
  d3.select('#map').selectAll('*').remove();
  const svg = d3.select('#map').append('svg')
    .attr('width', width)
    .attr('height', height);

  const projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(topoData, topoData.objects.states));
  const path = d3.geoPath().projection(projection);

  // Compute color scale based on current view mode
  const values = Array.from(wasteByState.values(), d => currentViewMode === 'per10k' ? d.per10k : d.totalWaste);
  const color = d3.scaleSequential()
    .domain([d3.min(values), d3.max(values)])
    .interpolator(d3.interpolateYlOrRd);

  // Draw states
  const g = svg.append('g');
  const states = g
    .selectAll('path')
    .data(topojson.feature(topoData, topoData.objects.states).features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = STATE_ID_TO_NAME.get(fips);
      const waste = wasteByState.get(stateName);
      if (!waste) return '#eee';
      return color(currentViewMode === 'per10k' ? waste.per10k : waste.totalWaste);
    })
    .attr('stroke', '#000')
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = STATE_ID_TO_NAME.get(fips);
      // Set opacity: only hovered and selected state are fully opaque
      states.transition().duration(200)
        .style('opacity', s => {
          const sFips = s.id.toString().padStart(2, '0');
          const sName = STATE_ID_TO_NAME.get(sFips);
          return (s === d || sName === selectedState) ? 1 : 0.2;
        });
      
      const currentYear = yearSlider ? +yearSlider.value : year;
      drawFoodWasteBySubSectorBar({ year: currentYear, state: stateName });
      drawFoodWasteByFoodTypeBar({ year: currentYear, state: stateName });
        
      // Tooltip
      const waste = wasteByState.get(stateName);
      let html = `<strong>${stateName}</strong>`;
      if (waste) {
        if (currentViewMode === 'per10k') {
          html += `<br/><span class="red-number">${waste.per10k.toLocaleString(undefined, {maximumFractionDigits: 2})} tons</span> per 10,000 people`;
        } else {
          html += `<br/><span class="red-number">${waste.totalWaste.toLocaleString(undefined, {maximumFractionDigits: 2})} tons</span> total`;
        }
      } else {
        html += '<br/>No data available';
      }
      tooltip.style('display', 'block').html(html);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      if (selectedState) {
        states.style('opacity', s => {
          const sFips = s.id.toString().padStart(2, '0');
          const sName = STATE_ID_TO_NAME.get(sFips);
          return (sName === selectedState) ? 1 : 0.2;
        });
      } else {
        const currentYear = yearSlider ? +yearSlider.value : year;
        drawFoodWasteBySubSectorBar({ year: currentYear, state: '' });
        drawFoodWasteByFoodTypeBar({ year: currentYear, state: '' });
        states.transition().duration(200).style('opacity', 1);
      }
      tooltip.style('display', 'none');
    })
    .on('click', function(event, d) {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = STATE_ID_TO_NAME.get(fips);
      const currentYear = yearSlider ? +yearSlider.value : year;
      if (selectedState === stateName) {
        selectedState = null;
        drawFoodWasteBySubSectorBar({ year: currentYear, state: '' });
        drawFoodWasteByFoodTypeBar({ year: currentYear, state: '' });
        states.transition().duration(200).style('opacity', 1);
      } else {
        selectedState = stateName;
        // Highlight only the selected state
        states.transition().duration(200)
          .style('opacity', s => {
            const sFips = s.id.toString().padStart(2, '0');
            const sName = STATE_ID_TO_NAME.get(sFips);
            return (sName === selectedState) ? 1 : 0.2;
            });
          // Draw plots for selected state
          drawFoodWasteBySubSectorBar({ year: currentYear, state: selectedState });
          drawFoodWasteByFoodTypeBar({ year: currentYear, state: selectedState });
      }
    });

  if(selectedState) {
    states.style('opacity', s => {
      const sFips = s.id.toString().padStart(2, '0');
      const sName = STATE_ID_TO_NAME.get(sFips);
      return (sName === selectedState) ? 1 : 0.2;
    });
  }
  else {
    states.style('opacity', 1);
  }
  
  d3.select('#reset-map').on('click', function() {
    g.transition().duration(750).attr('transform', null);
    selectedState = null;
    yearSlider.value = 2023;
    yearSliderValue.textContent = 2023;
    const currentYear = yearSlider ? +yearSlider.value : year;
    drawFoodWasteBySubSectorBar({ year: currentYear, state: '' });
    drawFoodWasteByFoodTypeBar({ year: currentYear, state: '' });
    states.transition().duration(200).style('opacity', 1);
    // Note: Don't reset the year slider - keep the user's selected year
  });

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');

  // After drawing the map, render the legend
  // Remove any previous legend
  d3.select('#map-legend').selectAll('*').remove();
  // Create SVG for legend
  const legendWidth = 260, legendHeight = 18;
  const legendSvg = d3.select('#map-legend')
    .append('svg')
    .attr('width', legendWidth)
    .attr('height', legendHeight + 24);
  // Gradient
  const defs = legendSvg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', 'legend-gradient')
    .attr('x1', '0%').attr('y1', '0%')
    .attr('x2', '100%').attr('y2', '0%');
  gradient.append('stop').attr('offset', '0%').attr('stop-color', color.range()[0]);
  gradient.append('stop').attr('offset', '100%').attr('stop-color', color.range()[1]);
  legendSvg.append('rect')
    .attr('x', 0)
    .attr('y', 8)
    .attr('width', legendWidth)
    .attr('height', legendHeight)
    .style('fill', 'url(#legend-gradient)');
  // Labels
  legendSvg.append('text')
    .attr('x', 0)
    .attr('y', legendHeight + 22)
    .attr('text-anchor', 'start')
    .attr('font-size', 12)
    .attr('fill', '#444')
    .text('Less');
  legendSvg.append('text')
    .attr('x', legendWidth)
    .attr('y', legendHeight + 22)
    .attr('text-anchor', 'end')
    .attr('font-size', 12)
    .attr('fill', '#444')
    .text('More');
  // Add view mode label
  legendSvg.append('text')
    .attr('x', legendWidth / 2)
    .attr('y', 6)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', '#444')
    .text(currentViewMode === 'per10k' ? 'Tons per 10,000 people' : 'Total tons');
}

function animateFoodWasteFalling(containerId, scale = 1, frequency = 400, preserveContent = false, leftShift = 40) {
  const container = d3.select(containerId);
  
  console.log(`animateFoodWasteFalling called - scale: ${scale}, preserveContent: ${preserveContent}`); // Debug log
  
  // Only clear content if we're not preserving it
  if (!preserveContent) {
    container.selectAll('*').remove();
    console.log('Cleared all content'); // Debug log
  } else {
    console.log('Preserving existing content'); // Debug log
  }
  
  // Use consistent base dimensions and fixed ground position
  const baseWidth = 400, baseHeight = 500; // Increased from 450 to 500 to prevent bottom cutoff
  const width = baseWidth * scale, height = baseHeight * scale;
  
  // Fixed ground position (doesn't scale with container)
  const fixedGroundY = 390; // Move plate up for more bottom margin
  const fixedPileWidth = 120; // Fixed pile width - reduced from 160 to prevent side cutoff
  const fixedPileHeight = 35; // Fixed pile height
  
  let svg = container.select('svg');
  
  // Create SVG if it doesn't exist
  if (svg.empty()) {
    console.log('Creating new SVG'); // Debug log
    svg = container.append('svg')
      .attr('width', width)
      .attr('height', height);
      
    // Draw ground/pile base - use fixed position
    svg.append('ellipse')
      .attr('cx', width/2 - leftShift)
      .attr('cy', fixedGroundY)
      .attr('rx', fixedPileWidth * scale)
      .attr('ry', fixedPileHeight * scale)
      .attr('fill', '#b5a27a')
      .attr('class', 'trash-pile-base');
  } else {
    console.log('Updating existing SVG'); // Debug log
    // Update existing SVG size but keep pile at fixed position
    svg.attr('width', width).attr('height', height);
    
    // Update or create the pile base
    let pileBase = svg.select('.trash-pile-base');
    if (pileBase.empty()) {
      pileBase = svg.append('ellipse')
        .attr('class', 'trash-pile-base');
    }
    
    pileBase
      .attr('cx', width/2 - leftShift)
      .attr('cy', fixedGroundY) // Keep at fixed position
      .attr('rx', fixedPileWidth * scale)
      .attr('ry', fixedPileHeight * scale)
      .attr('fill', '#b5a27a');
      
    // Update existing circles - only scale their X positions and sizes, keep Y relative to fixed ground
    const existingCircles = svg.selectAll('.falling-circle');
    console.log(`Found ${existingCircles.size()} existing circles`); // Debug log
    
    existingCircles.each(function() {
      const currentTransform = d3.select(this).attr('transform');
      if (currentTransform) {
        const translate = currentTransform.match(/translate\(([^,]+),([^)]+)\)/);
        if (translate) {
          const x = parseFloat(translate[1]);
          const y = parseFloat(translate[2]);
          // Scale X position proportionally, but keep Y positions relative to fixed ground
          const newX = (x / baseWidth) * width;
          // Keep Y position the same (no scaling for vertical position)
          d3.select(this).attr('transform', `translate(${newX},${y})`);
        }
      }
    });
  }

  // Trash-like colors for circles
  const trashColors = [
    '#b5a27a', '#e0e0e0', '#7fd3e6', '#a3c586', '#f5e6c8', '#b0b0b0',
    '#fffbe6', '#ffe066', '#e74c3c', '#6a7b8c', '#e2b07a', '#e0f7fa'
  ];

  function dropCircle() {
    // Clean up old circles if there are too many (performance optimization)
    const existingCircles = svg.selectAll('.falling-circle');
    if (existingCircles.size() > 100) {
      existingCircles.filter((d, i) => i < 20).remove(); // Remove oldest 20 circles
    }
    
    // Determine how many circles to drop based on frequency (more intense = more circles)
    let numCircles = 1;
    if (frequency <= 50) {
      numCircles = 3; // Drop 3 circles for city section
    } else if (frequency <= 75) {
      numCircles = 2; // Drop 2 circles for very fast sections
    }
    
    // Drop multiple circles for more intensity
    for (let i = 0; i < numCircles; i++) {
      const x = width/2 - leftShift + (Math.random()-0.5)*180*scale; // Shift left
      const r = (8 + Math.random()*12) * scale; // Scale circle size
      const color = trashColors[Math.floor(Math.random()*trashColors.length)];
      const g = svg.append('g').attr('class', 'falling-circle');
      g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', r)
        .attr('fill', color)
        .attr('opacity', 0.95);
      g.attr('transform', `translate(${x},-30)`);
      
      // Land at fixed ground position with some randomness
      const landingY = fixedGroundY - 20 - Math.random()*15; // Much closer to ground (was -60 with -25 random)
      
      // Add slight delay between multiple drops for more natural effect
      const delay = i * 50; // 50ms delay between each circle in a batch
      
      setTimeout(() => {
        g.transition()
          .duration(scale > 1 ? 1200 : 1600 * (2 - scale*0.5)) // Faster for household (1200ms vs 1600ms)
          .ease(d3.easeBounce)
          .attr('transform', `translate(${x},${landingY})`)
          .on('end', function() {
            d3.select(this).style('opacity', 1);
          });
      }, delay);
    }
  }

  return setInterval(dropCircle, frequency);
}

// Function to handle layered scrolling text boxes
function initLayeredScrolling() {
  const scrollContainer = document.getElementById('scrolly-foodwaste');
  const textBoxes = document.querySelectorAll('.moving-text-box');
  
  function updateTextBoxPositions() {
    const scrollTop = window.pageYOffset;
    const containerTop = scrollContainer.offsetTop;
    const containerHeight = scrollContainer.offsetHeight;
    const containerBottom = containerTop + containerHeight;
    const progress = Math.max(0, Math.min(1, (scrollTop - containerTop) / (containerHeight * 0.8)));
    
    // Hide all text boxes if we're completely past the scrollytelling section
    if (scrollTop > containerBottom + 200) { // Added buffer to ensure they disappear
      textBoxes.forEach(box => {
        box.style.display = 'none';
      });
      return;
    } else {
      // Show text boxes when we're in or approaching the section
      textBoxes.forEach(box => {
        box.style.display = 'block';
      });
    }
    
    textBoxes.forEach((box, index) => {
      // Each text box appears at different scroll progress points
      const startProgress = index * 0.13; // Adjusted for 7 boxes: 0, 0.13, 0.26, 0.39, 0.52, 0.65, 0.78
      const endProgress = startProgress + 0.22; // Duration of visibility
      
      if (progress >= startProgress && progress <= endProgress) {
        // Box is active and moving through the viewport
        const boxProgress = (progress - startProgress) / (endProgress - startProgress);
        
        // Move from bottom of screen (100vh) to top of screen (-20vh)
        const topPosition = 100 - (boxProgress * 120); // vh units
        
        box.style.top = `${topPosition}vh`;
        box.style.opacity = 1;
        box.classList.add('active');
        
        // Update food visualization based on active text box
        if (boxProgress >= 0.25 && boxProgress <= 0.75) {
          if (index === 0) {
            updateFoodVisualization('day');
            updateTrashSummary('day');
            updateTrashAnimation('day');
          } else if (index === 1) {
            updateFoodVisualization('month');
            updateTrashSummary('month');
            updateTrashAnimation('month');
          } else if (index === 2) {
            updateFoodVisualization('year');
            updateTrashSummary('year');
            updateTrashAnimation('year');
          } else if (index === 3) {
            updateFoodVisualization('householdYear');
            updateTrashSummary('householdYear');
            updateTrashAnimation('householdYear');
          } else if (index === 4) {
            updateFoodVisualization('cityYear');
            updateTrashSummary('cityYear');
            updateTrashAnimation('cityYear');
          } else if (index === 5) {
            updateFoodVisualization('stateYear');
            updateTrashSummary('stateYear');
            updateTrashAnimation('stateYear');
          } else if (index === 6) {
            // Country section - transition away from food visualization
            // The country section will have its own separate visualization
            updateFoodVisualization('stateYear'); // Keep showing state for smooth transition
            updateTrashSummary('countryYear');
            updateTrashAnimation('stateYear');
          }
        }
        
        // Also update during the main visibility period to ensure sync
        if (boxProgress >= 0.15 && boxProgress <= 0.85) {
          if (index === 0 && currentFoodVisualization !== 'day') {
            updateFoodVisualization('day');
            updateTrashSummary('day');
            updateTrashAnimation('day');
          } else if (index === 1 && currentFoodVisualization !== 'month') {
            updateFoodVisualization('month');
            updateTrashSummary('month');
            updateTrashAnimation('month');
          } else if (index === 2 && currentFoodVisualization !== 'year') {
            updateFoodVisualization('year');
            updateTrashSummary('year');
            updateTrashAnimation('year');
          } else if (index === 3 && currentFoodVisualization !== 'householdYear') {
            updateFoodVisualization('householdYear');
            updateTrashSummary('householdYear');
            updateTrashAnimation('householdYear');
          } else if (index === 4 && currentFoodVisualization !== 'cityYear') {
            updateFoodVisualization('cityYear');
            updateTrashSummary('cityYear');
            updateTrashAnimation('cityYear');
          } else if (index === 5 && currentFoodVisualization !== 'stateYear') {
            updateFoodVisualization('stateYear');
            updateTrashSummary('stateYear');
            updateTrashAnimation('stateYear');
          } else if (index === 6) {
            // Country section handling
            updateTrashSummary('countryYear');
          }
        }
        
        // Fade effects at edges
        if (boxProgress < 0.1 || boxProgress > 0.9) {
          box.style.opacity = 0.4;
        }
      } else if (progress > endProgress) {
        // Box has passed through - position above screen and hide
        box.style.top = '-20vh';
        box.style.opacity = 0;
        box.classList.remove('active', 'passing');
      } else {
        // Box hasn't arrived yet - position below screen
        box.style.top = '100vh';
        box.style.opacity = 0;
        box.classList.remove('active', 'passing');
      }
    });
  }
  
  // Listen for scroll events with throttling for better performance
  let ticking = false;
  function handleScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateTextBoxPositions();
        ticking = false;
      });
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', handleScroll);
  
  // Initial position update
  updateTextBoxPositions();
}

// Initialize all visualizations when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize sidebar menu
  initSidebarMenu();

  // Initialize the map with default values
  drawFoodWasteMap(2023);

  // --- Food waste scrollytelling calculations and visuals ---
  loadGlobalData().then(({ wasteData }) => {
    // Filter for 2023
    const data2023 = wasteData.filter(d => d.year === 2023);
    // Sum total waste and population using shared constant
    let totalTons = 0;
    let totalPop = 0;
    for (const state of Object.keys(STATE_POPULATION_2023)) {
      const stateWaste = data2023.filter(d => d.state === state);
      totalTons += d3.sum(stateWaste, d => d.tons_waste);
      totalPop += STATE_POPULATION_2023[state];
    }
    const totalLbs = totalTons * 2000;
    const perPersonYear = totalLbs / totalPop;
    const perPersonDay = perPersonYear / 365;
    const perPersonMonth = perPersonDay * 30;
    // Round for display
    const r = x => Math.round(x);
    
    // Calculate household amounts (average household size is 2.5 people)
    const householdSize = 2.5;
    const perHouseholdDay = perPersonDay * householdSize;
    const perHouseholdMonth = perPersonMonth * householdSize;
    const perHouseholdYear = perPersonYear * householdSize;
    
    // Calculate city amounts (average city size is 100,000 people)
    const citySize = 100000;
    const perCityYear = perPersonYear * citySize;
    
    // Calculate state amounts (average state size is 6.5 million people)
    const stateSize = 6500000;
    const perStateYear = perPersonYear * stateSize;
    
    // Calculate country amounts (entire USA population ~333 million people)
    const perCountryYear = totalLbs;
    
    // Store values globally for content changes
    window.foodWasteData = {
      day: r(perPersonDay),
      month: r(perPersonMonth),
      year: r(perPersonYear),
      householdDay: r(perHouseholdDay),
      householdMonth: r(perHouseholdMonth),
      householdYear: r(perHouseholdYear),
      cityYear: Math.round(perCityYear / 1000000), // Convert to millions
      stateYear: Math.round(perStateYear / 1000000000), // Convert to billions
      countryYear: 126 // Fixed to correct 126 billion pounds
    };
    
    // Populate the text boxes with calculated values
    document.getElementById('day-number').textContent = window.foodWasteData.day;
    document.getElementById('month-number').textContent = window.foodWasteData.month;
    document.getElementById('year-number').textContent = window.foodWasteData.year;
    
    // Populate household text boxes - only year
    document.getElementById('household-year-number').textContent = window.foodWasteData.householdYear;
    
    // Populate city and state text boxes
    document.getElementById('city-year-number').textContent = window.foodWasteData.cityYear;
    document.getElementById('state-year-number').textContent = window.foodWasteData.stateYear;
    
    // Populate country text box
    document.getElementById('country-year-number').textContent = window.foodWasteData.countryYear;
    
    // Initialize both visualizations with day data
    currentFoodVisualization = null; // Reset to ensure updates work
    currentTrashSummary = null; // Reset to ensure updates work
    currentSection = null; // Reset section tracking
    updateFoodVisualization('day');
    updateTrashSummary('day');
    updateTrashAnimation('day'); // This will set up the initial animation
    
    // Initialize layered scrolling system
    initLayeredScrolling();
    
    // Initialize country section
    initCountrySection();
  });

  // Initialize causes, effects, and solutions visualizations
  initCausesEffectsSolutionsVisualizations();

  // Add this function to render the US-wide sub_sector bar chart with initial year
  const yearSlider = document.getElementById('year-slider');
  const initialYear = yearSlider ? +yearSlider.value : 2023;
  drawFoodWasteBySubSectorBar({ year: initialYear, state: '' });
  drawFoodWasteByFoodTypeBar({ year: initialYear, state: '' });

  // Reveal post-map sections with animation as they enter the viewport
  setupRevealSections();
});

// Global variable to track current food visualization and prevent rapid switching
let currentFoodVisualization = null;
let currentTrashSummary = null;
let isAnimating = false;
let currentTrashAnimation = null; // Track current animation interval
let currentSection = null; // Track current section (person vs household)
let selectedState = null;

// Function to update food visualization based on current step
function updateFoodVisualization(period) {
  // Don't switch if we're already showing this period or currently animating
  if (currentFoodVisualization === period || isAnimating) {
    return;
  }
  
  isAnimating = true;
  currentFoodVisualization = period;
  
  const container = document.getElementById('food-visualization-area');
  
  // Add fade-out animation before changing content
  container.style.opacity = '0.3';
  container.style.transform = 'scale(0.95)';
  
  // Wait for fade-out, then change content and fade-in
  setTimeout(() => {
    if (period === 'day') {
      // Day: Apples (0.33 lbs each)
      const appleWeight = 0.33;
      const numApples = Math.max(1, Math.round(window.foodWasteData.day / appleWeight));
      let applesHTML = '';
      const applesPerRow = 8;
      const appleRows = Math.ceil(numApples / applesPerRow);
      const appleGridWidth = applesPerRow * 32; // 32px per emoji
      const appleHTMLWidth = 450;
      const appleHTMLHeight = 250;
      const appleXOffset = (appleHTMLWidth - appleGridWidth) / 2;
      const appleYStart = 0;
      applesHTML += `<div style="width:${appleHTMLWidth}px;height:${appleHTMLHeight}px;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:0 auto;">`;
      for (let i = 0; i < numApples; i++) {
        applesHTML += `<span style="font-size:32px;line-height:36px;width:32px;height:36px;display:inline-block;text-align:center;">🍎</span>`;
      }
      applesHTML += `</div>`;
      container.innerHTML = `
        ${applesHTML}
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numApples} apples (0.33 lbs each)</div>
      `;
    } else if (period === 'month') {
      // Month: Loaves of bread (1 lb each)
      const loafWeight = 1;
      const numLoaves = Math.max(1, Math.round(window.foodWasteData.month / loafWeight));
      let loavesHTML = '';
      const loavesPerRow = 8;
      const loafRows = Math.ceil(numLoaves / loavesPerRow);
      const loafGridWidth = loavesPerRow * 32;
      const loafHTMLWidth = 450;
      const loafHTMLHeight = 280;
      loavesHTML += `<div style=\"width:${loafHTMLWidth}px;height:${loafHTMLHeight}px;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:0 auto;\">`;
      for (let i = 0; i < numLoaves; i++) {
        loavesHTML += `<span style=\"font-size:32px;line-height:36px;width:32px;height:36px;display:inline-block;text-align:center;\">🍞</span>`;
      }
      loavesHTML += `</div>`;
      container.innerHTML = `
        ${loavesHTML}
        <div style=\"text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;\">That's about ${numLoaves} loaves of bread (1 lb each)</div>
      `;
    } else if (period === 'year') {
      // Year: Watermelons (5 lbs each)
      const melonWeight = 5;
      const numMelons = Math.max(1, Math.round(window.foodWasteData.year / melonWeight));
      let melonsHTML = '';
      const melonsPerRow = 8;
      const melonRows = Math.ceil(numMelons / melonsPerRow);
      const melonGridWidth = melonsPerRow * 32;
      const melonHTMLWidth = 480;
      const melonHTMLHeight = 320;
      melonsHTML += `<div style=\"width:${melonHTMLWidth}px;height:${melonHTMLHeight}px;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:0 auto;\">`;
      for (let i = 0; i < numMelons; i++) {
        melonsHTML += `<span style=\"font-size:32px;line-height:36px;width:32px;height:36px;display:inline-block;text-align:center;\">🍉</span>`;
      }
      melonsHTML += `</div>`;
      container.innerHTML = `
        ${melonsHTML}
        <div style=\"text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;\">That's about ${numMelons} watermelons (5 lbs each)</div>
      `;
    } else if (period === 'householdYear') {
      // Household Year: Grocery bags (15 lbs each)
      const bagWeight = 15;
      const numBags = Math.max(1, Math.round(window.foodWasteData.householdYear / bagWeight));
      let bagsHTML = '';
      const bagsPerRow = 8;
      const bagRows = Math.ceil(numBags / bagsPerRow);
      const bagGridWidth = bagsPerRow * 32;
      const bagHTMLWidth = 580;
      const bagHTMLHeight = 450;
      bagsHTML += `<div style=\"width:${bagHTMLWidth}px;height:${bagHTMLHeight}px;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:0 auto;\">`;
      for (let i = 0; i < numBags; i++) {
        bagsHTML += `<span style=\"font-size:32px;line-height:36px;width:32px;height:36px;display:inline-block;text-align:center;\">🧺</span>`;
      }
      bagsHTML += `</div>`;
      container.innerHTML = `
        ${bagsHTML}
        <div style=\"text-align:center;font-size:1.4em;color:#666;margin-top:15px;font-weight:500;\">That's about ${numBags} full grocery bags (15 lbs each)</div>
      `;
    } else if (period === 'cityYear') {
      // City Year: Delivery trucks (2000 lbs each)
      const truckWeight = 2000;
      const totalTrucks = Math.max(1, Math.round((window.foodWasteData.cityYear * 1000000) / truckWeight));
      const trucksPerRow = 18;
      const maxRows = 8;
      const maxEmojis = trucksPerRow * maxRows; // 56 emojis
      const numTrucksToShow = Math.min(totalTrucks, maxEmojis);
      const trucksPerEmoji = Math.ceil(totalTrucks / numTrucksToShow);
      let trucksHTML = '';
      const truckGridWidth = trucksPerRow * 32;
      const truckHTMLWidth = 580;
      const truckHTMLHeight = 320;
      trucksHTML += `<div style=\"width:${truckHTMLWidth}px;height:${truckHTMLHeight}px;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:0 auto;\">`;
      for (let i = 0; i < numTrucksToShow; i++) {
        trucksHTML += `<span style=\"font-size:32px;line-height:36px;width:32px;height:36px;display:inline-block;text-align:center;\">🚚</span>`;
      }
      trucksHTML += `</div>`;
      container.innerHTML = `
        ${trucksHTML}
        <div style=\"text-align:center;font-size:1.1em;color:#888;margin-top:8px;\">Each truck = ${trucksPerEmoji} actual trucks</div>
        <div style=\"text-align:center;font-size:1.4em;color:#666;margin-top:15px;font-weight:500;\">That's about ${totalTrucks} delivery trucks full of food (2000 lbs each)</div>
      `;
    } else if (period === 'stateYear') {
      // State Year: Cargo ships (10 million lbs each - representing massive industrial scale)
      const shipWeight = 10000000; // 10 million lbs per cargo ship
      const numShips = Math.max(1, Math.round((window.foodWasteData.stateYear * 1000000000) / shipWeight));
      let shipsHTML = '';
      const shipsPerRow = 8;
      const shipRows = Math.ceil(numShips / shipsPerRow);
      const shipGridWidth = shipsPerRow * 32;
      const shipHTMLWidth = 580;
      const shipHTMLHeight = 450;
      shipsHTML += `<div style=\"width:${shipHTMLWidth}px;height:${shipHTMLHeight}px;display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:center;margin:0 auto;\">`;
      for (let i = 0; i < numShips; i++) {
        shipsHTML += `<span style=\"font-size:32px;line-height:36px;width:32px;height:36px;display:inline-block;text-align:center;\">🚢</span>`;
      }
      shipsHTML += `</div>`;
      container.innerHTML = `
        ${shipsHTML}
        <div style=\"text-align:center;font-size:1.4em;color:#666;margin-top:15px;font-weight:500;\">That's about ${numShips} ferries full of food (10 million lbs each)</div>
      `;
    }
    
    // Fade-in animation after content change
    setTimeout(() => {
      container.style.opacity = '1';
      container.style.transform = 'scale(1)';
      
      // Reset animation flag after fade-in completes
      setTimeout(() => {
        isAnimating = false;
      }, 200);
    }, 50); // Small delay to ensure content is rendered
    
  }, 200); // Wait for fade-out animation
}

// Function to update the trash summary text
function updateTrashSummary(period) {
  // Don't update if we're already showing this period or currently animating
  if (currentTrashSummary === period) {
    return;
  }
  
  currentTrashSummary = period;
  
  const summaryElement = document.getElementById('trash-summary');
  const amountElement = document.getElementById('summary-amount');
  
  if (!window.foodWasteData) return;
  
  // Add fade-out animation
  summaryElement.style.opacity = '0.4';
  summaryElement.style.transform = 'scale(0.95)';
  
  setTimeout(() => {
    switch(period) {
      case 'day':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.day}</span> lb of food wasted per day`;
        break;
      case 'month':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.month}</span> lbs of food wasted per month`;
        break;
      case 'year':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.year}</span> lbs of food wasted per year`;
        break;
      case 'householdYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.householdYear}</span> lbs of food wasted per household per year`;
        break;
      case 'cityYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.cityYear}</span> million lbs of food wasted per city per year`;
        break;
      case 'stateYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.stateYear}</span> billion lbs of food wasted per state per year`;
        break;
      case 'countryYear':
        summaryElement.innerHTML = `<span class="amount">${window.foodWasteData.countryYear}</span> billion lbs of food wasted nationally per year`;
        break;
    }
    
    // Fade back in
    setTimeout(() => {
      summaryElement.style.opacity = '1';
      summaryElement.style.transform = 'scale(1)';
    }, 50);
  }, 150);
}

// Function to update the trash animation scale based on section
function updateTrashAnimation(period) {
  // Determine which section we're in
  let newSection = 'person'; // default
  let leftShift = 40;
  if (period.includes('household')) {
    newSection = 'household';
    leftShift = 60;
  } else if (period.includes('city')) {
    newSection = 'city';
    leftShift = 60;
  } else if (period.includes('state')) {
    newSection = 'state';
    leftShift = 60;
  } else if (period.includes('country')) {
    newSection = 'country';
    leftShift = 60;
  }
  // Only update if we're actually switching sections OR if no animation exists yet
  if (newSection !== currentSection || !currentTrashAnimation) {
    console.log(`Transitioning from ${currentSection} to ${newSection}`); // Debug log
    
    // Clear existing animation interval
    if (currentTrashAnimation) {
      clearInterval(currentTrashAnimation);
    }
    
    let scale = 1;
    let frequency = 400;
    let preserveContent = false;
    
    if (newSection === 'household') {
      scale = 1.3; // 30% larger for household
      frequency = 150; // Much faster drops (was 250ms, now 150ms)
      preserveContent = (currentSection === 'person'); // Preserve if transitioning from person
      console.log(`Household section - preserveContent: ${preserveContent}`); // Debug log
    } else if (newSection === 'city') {
      scale = 1.3; // Keep same scale as household to avoid cutting
      frequency = 50; // Much faster drops for more intensity
      preserveContent = (currentSection === 'person' || currentSection === 'household'); // Preserve from previous sections
      console.log(`City section - preserveContent: ${preserveContent}`); // Debug log
    } else if (newSection === 'state') {
      scale = 1.3; // Keep same scale as city to avoid cutting
      frequency = 40; // Extremely fast drops
      preserveContent = (currentSection === 'person' || currentSection === 'household' || currentSection === 'city'); // Preserve from previous sections
      console.log(`State section - preserveContent: ${preserveContent}`); // Debug log
    } else {
      scale = 1; // Normal size for person
      frequency = 400; // Normal frequency
      preserveContent = false; // Always start fresh for person section
      console.log(`Person section - starting fresh`); // Debug log
    }
    
    // Start new animation with updated parameters
    currentTrashAnimation = animateFoodWasteFalling('#fixed-trash-animation', scale, frequency, preserveContent, leftShift);
    currentSection = newSection;
  }
  // If we're in the same section, do nothing - let the animation continue
}

// Country section food emoji filling functionality
function initCountrySection() {
  const countryHeadlineSection = document.getElementById('country-headline-section');
  const countrySection = document.getElementById('country-section');
  const countryVisual = document.getElementById('country-visual');
  const scaleLabels = document.getElementById('scale-labels');
  const headline = document.getElementById('country-headline');
  const subtext1 = document.getElementById('country-subtext-1');
  const subtext2 = document.getElementById('country-subtext-2');
  const countryHeader = document.querySelector('.country-header');
  
  // Food emojis to use
  const foodEmojis = ['🍎', '🍌', '🍞', '🥕', '🍅', '🥔', '🥬', '🍇', '🍊', '🥒', '🌽', '🥖', '🧄', '🫐', '🍑', '🥝', '🍐', '🥯', '🥨', '🧅'];
  
  // Create scale labels
  const maxValue = window.foodWasteData.countryYear;
  for (let i = 0; i <= 10; i++) {
    const value = Math.round((maxValue * i) / 10);
    const tick = document.createElement('div');
    tick.className = 'scale-tick';
    tick.textContent = `${value}B lbs`;
    scaleLabels.appendChild(tick);
  }
  
  // Generate grid of food emojis
  // Dynamically calculate columns based on container width and emoji size
  const emojiSize = 32; // px, matches .food-emoji font-size in CSS
  const scaleSafeZone = 200; // px, increased padding on the right
  const containerWidth = countryVisual.offsetWidth || window.innerWidth;
  const availableWidth = containerWidth - scaleSafeZone;
  const cols = Math.floor(availableWidth / emojiSize);
  const rows = 50; // Keep rows fixed for now
  const totalEmojis = rows * cols;

  for (let i = 0; i < totalEmojis; i++) {
    const emoji = document.createElement('div');
    emoji.className = 'food-emoji';
    emoji.textContent = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
    const row = Math.floor(i / cols);
    const col = i % cols;
    // Place emojis only within the available width (0% to (availableWidth/containerWidth)*100%)
    const leftPercent = (col / (cols - 1)) * (availableWidth / containerWidth) * 100;
    emoji.style.left = `${leftPercent}%`;
    emoji.style.top = `${(row / (rows - 1)) * 95}%`;
    countryVisual.appendChild(emoji);
  }
  
  // Scroll-based filling animation
  function updateCountryVisualization() {
    const headlineRect = countryHeadlineSection.getBoundingClientRect();
    const visualRect = countrySection.getBoundingClientRect();
    const transitionRect = document.getElementById('transition-section').getBoundingClientRect();
    const countryConclusion = document.getElementById('country-conclusion');
    const countryConclusionSection = document.getElementById('country-conclusion-section');
    const viewportHeight = window.innerHeight;
    
    // Handle headline section
    if (headlineRect.top <= viewportHeight && headlineRect.bottom >= 0) {
      const headlineProgress = Math.max(0, Math.min(1, (viewportHeight - headlineRect.top) / viewportHeight));
      
      // Sequential animation: headline first, then each subtext with delays
      if (headlineProgress > 0.2) {
        countryHeader.classList.add('animate');
      } else {
        countryHeader.classList.remove('animate');
      }
    }
    
    // Handle visualization section
    if (visualRect.top <= viewportHeight && visualRect.bottom >= 0) {
      const visualProgress = Math.max(0, Math.min(1, (viewportHeight - visualRect.top) / (viewportHeight + visualRect.height)));
      
      // Fill emojis from top to bottom
      const emojis = countryVisual.querySelectorAll('.food-emoji');
      const fillProgress = Math.max(0, Math.min(1, visualProgress / 0.8)); // Fill throughout the visualization scroll
      
      // Calculate how many rows to fill based on progress
      const rowsToFill = Math.floor(fillProgress * rows);
      const partialRowProgress = (fillProgress * rows) - rowsToFill;
      
      emojis.forEach((emoji, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        let shouldShow = false;
        
        if (row < rowsToFill) {
          // Show complete rows
          shouldShow = true;
        } else if (row === rowsToFill) {
          // Show partial row based on progress
          const colsToShow = Math.floor(partialRowProgress * cols);
          shouldShow = col < colsToShow;
        }
        
        if (shouldShow) {
          if (!emoji.classList.contains('visible')) {
            emoji.classList.add('visible', 'animate');
            setTimeout(() => emoji.classList.remove('animate'), 600);
          }
        } else {
          emoji.classList.remove('visible', 'animate');
        }
      });
    }
    
    // Handle country conclusion section
    if (countryConclusionSection) {
      const conclusionRect = countryConclusionSection.getBoundingClientRect();
      if (conclusionRect.top <= viewportHeight * 0.8 && conclusionRect.bottom >= 0) {
        countryConclusion.classList.add('visible');
      } else {
        countryConclusion.classList.remove('visible');
      }
    }
    
    // Handle transition section fade-in
    if (transitionRect.top <= viewportHeight && transitionRect.bottom >= 0) {
      const transitionProgress = Math.max(0, Math.min(1, (viewportHeight - transitionRect.top) / (viewportHeight + transitionRect.height)));
      const transitionHeader = document.getElementById('transition-header');
      const transitionText1 = document.getElementById('transition-text-1');
      const transitionText2 = document.getElementById('transition-text-2');
      const transitionArrowSection = document.getElementById('transition-arrow-section');
      
      // Header appears when 15% through the section
      if (transitionProgress > 0.15) {
        transitionHeader.classList.add('visible');
      } else {
        transitionHeader.classList.remove('visible');
      }
      
      // First text appears when 35% through the section
      if (transitionProgress > 0.35) {
        transitionText1.classList.add('visible');
      } else {
        transitionText1.classList.remove('visible');
      }
      
      // Second text and arrow appear together when 30% through the section (reduced from 60%)
      if (transitionProgress > 0.3) {
        transitionText2.classList.add('visible');
        transitionArrowSection.classList.add('visible');
      } else {
        transitionText2.classList.remove('visible');
        transitionArrowSection.classList.remove('visible');
      }
    }
  }
  
  // Throttled scroll listener
  let ticking = false;
  function handleCountryScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateCountryVisualization();
        ticking = false;
      });
      ticking = true;
    }
  }
  
  window.addEventListener('scroll', handleCountryScroll);
  
  // Initial update
  updateCountryVisualization();
}
// Sidebar Menu Functionality
function initSidebarMenu() {
  const menuToggle = document.getElementById('menu-toggle');
  const closeMenu = document.getElementById('close-menu');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const menuLinks = document.querySelectorAll('.sidebar-menu a[href^="#"]');

  // Open sidebar
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
    menuToggle.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  }

  // Close sidebar
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    menuToggle.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
  }

  // Toggle sidebar
  menuToggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Close sidebar when clicking close button
  closeMenu.addEventListener('click', closeSidebar);

  // Close sidebar when clicking overlay
  overlay.addEventListener('click', closeSidebar);

  // Handle menu link clicks
  menuLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        closeSidebar();
        
        // Smooth scroll to target section
        const targetId = href.substring(1);
        const targetElement = document.getElementById(targetId) || document.querySelector(href);
        
        if (targetElement) {
          // Add some offset for the fixed header
          const headerHeight = document.querySelector('.newspaper-header').offsetHeight;
          const targetPosition = targetElement.offsetTop - headerHeight - 20;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      } else if (href && !href.startsWith('http') && !href.includes('://')) {
        // Handle relative page links (like about.html)
        closeSidebar();
        // Let the browser handle the navigation naturally
      } else {
        // External links - close sidebar but let browser handle
        closeSidebar();
      }
    });
  });

  // Close sidebar on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      closeSidebar();
    }
  });
}

// Data visualization functions for causes, effects, and solutions section
function initCausesEffectsSolutionsVisualizations() {
    // Initialize all visualizations
    initCausesChart();
    initEffectsChart();
    initSolutionsChart();
    initImpactChart();
}

function initCausesChart() {
    const container = d3.select('#waste-causes-chart');
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 550; // Increased height for better layout
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Enhanced data with more categories and details
    const data = [
        { category: 'Consumer Overbuying', value: 21, color: '#e74c3c', description: 'Impulse purchases and poor planning' },
        { category: 'Restaurant Portions', value: 17, color: '#3498db', description: 'Oversized servings in food service' },
        { category: 'Date Label Confusion', value: 15, color: '#f39c12', description: '"Best by" vs "use by" misunderstanding' },
        { category: 'Improper Storage', value: 12, color: '#9b59b6', description: 'Poor temperature and humidity control' },
        { category: 'Cosmetic Standards', value: 11, color: '#1abc9c', description: 'Rejection of "imperfect" produce' },
        { category: 'Supply Chain Issues', value: 9, color: '#95a5a6', description: 'Transportation and logistics problems' },
        { category: 'Overproduction', value: 8, color: '#e67e22', description: 'Farming and manufacturing excess' },
        { category: 'Other Factors', value: 7, color: '#34495e', description: 'Equipment failures, contamination, etc.' }
    ];
    
    const radius = Math.min(width, height - 100) / 2 - 60;
    const arc = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius)
        .cornerRadius(3);
    
    const outerArc = d3.arc()
        .innerRadius(radius * 1.1)
        .outerRadius(radius * 1.1);
    
    const pie = d3.pie()
        .value(d => d.value)
        .sort(null)
        .padAngle(0.01);
    
    const g = svg.append('g')
        .attr('transform', `translate(${width/2}, ${height/2 - 20})`);
    
    // Add title
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '22px')
        .style('font-weight', 'bold')
        .style('fill', '#2c3e50')
        .text('Major Causes of Food Waste');
    
    // Add subtitle
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#7f8c8d')
        .text('Distribution of waste factors in the US food system');
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'causes-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000);
    
    // Create pie chart segments with animation
    const arcs = g.selectAll('.arc')
        .data(pie(data))
        .enter().append('g')
        .attr('class', 'arc');
    
    const paths = arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('stroke', '#333')
        .style('stroke-width', '2px')
        .style('opacity', 0.85)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 1)
                .attr('transform', 'scale(1.05)');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            tooltip.html(`
                <div style="text-align: center;">
                    <strong>${d.data.category}</strong><br/>
                    <span style="font-size: 16px; color: ${d.data.color};">${d.data.value}%</span><br/>
                    <span style="font-size: 11px; opacity: 0.9;">${d.data.description}</span>
                </div>
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .style('opacity', 0.85)
                .attr('transform', 'scale(1)');
            
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
    
    // Animate the pie chart
    paths.transition()
        .delay((d, i) => i * 100)
        .duration(800)
        .attrTween('d', function(d) {
            const interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
            return function(t) { return arc(interpolate(t)); };
        });
    
    // Add polyline labels for better readability
    const polylines = arcs.append('polyline')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('fill', 'none')
        .style('opacity', 0);
    
    const labels = arcs.append('text')
        .style('font-size', '12px')
        .style('font-weight', '500')
        .style('opacity', 0);
    
    // Position labels with polylines
    setTimeout(() => {
        arcs.each(function(d) {
            const centroid = arc.centroid(d);
            const outerCentroid = outerArc.centroid(d);
            const labelPos = outerArc.centroid(d);
            labelPos[0] = radius * 1.3 * (midAngle(d) < Math.PI ? 1 : -1);
            
            d3.select(this).select('polyline')
                .attr('points', [centroid, outerCentroid, labelPos])
                .transition()
                .duration(800)
                .style('opacity', 0.7);
            
            d3.select(this).select('text')
                .attr('transform', `translate(${labelPos})`)
                .attr('text-anchor', midAngle(d) < Math.PI ? 'start' : 'end')
                .text(`${d.data.category} (${d.data.value}%)`)
                .transition()
                .duration(800)
                .style('opacity', 1);
        });
    }, 1000);
    
    function midAngle(d) {
        return d.startAngle + (d.endAngle - d.startAngle) / 2;
    }
    
    // Add center text
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.5em')
        .style('font-size', '24px')
        .style('font-weight', 'bold')
        .style('fill', '#2c3e50')
        .text('Food Waste');
    
    g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1em')
        .style('font-size', '16px')
        .style('fill', '#7f8c8d')
        .text('Contributing Factors');
}

function initEffectsChart() {
    const container = d3.select('#waste-effects-chart');
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 550;
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Enhanced data with multiple metrics and detailed information
    const data = [
        { 
            category: 'Greenhouse Gas Emissions', 
            percentage: 8, 
            absoluteValue: '170 million tons CO₂e',
            icon: '🌡️',
            description: 'Equivalent to 37 million cars on the road',
            color: '#e74c3c'
        },
        { 
            category: 'Water Consumption', 
            percentage: 21, 
            absoluteValue: '21 trillion gallons',
            icon: '💧',
            description: 'Could supply 500 million people for a year',
            color: '#3498db'
        },
        { 
            category: 'Agricultural Land Use', 
            percentage: 28, 
            absoluteValue: '56 million acres',
            icon: '🌱',
            description: 'Area larger than the state of Nebraska',
            color: '#27ae60'
        },
        { 
            category: 'Energy Consumption', 
            percentage: 15, 
            absoluteValue: '350 trillion BTUs',
            icon: '⚡',
            description: 'Powers 3 million homes for a year',
            color: '#f39c12'
        },
        { 
            category: 'Economic Loss', 
            percentage: 35, 
            absoluteValue: '$408 billion',
            icon: '💰',
            description: 'Lost economic value annually',
            color: '#9b59b6'
        }
    ];
    
    const margin = { top: 80, right: 30, bottom: 100, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.percentage) * 1.1])
        .range([innerHeight, 0]);
    
    // Create gradient definitions
    const defs = svg.append('defs');
    data.forEach((d, i) => {
        const gradient = defs.append('linearGradient')
            .attr('id', `gradient-${i}`)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', 0).attr('y1', innerHeight)
            .attr('x2', 0).attr('y2', 0);
        
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', d.color)
            .attr('stop-opacity', 0.8);
        
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', d.color)
            .attr('stop-opacity', 1);
    });
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'effects-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '15px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000)
        .style('box-shadow', '0 4px 15px rgba(0,0,0,0.3)');
    
    // Add title
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '22px')
        .style('font-weight', 'bold')
        .style('fill', '#2c3e50')
        .text('Environmental Impact of Food Waste');
    
    // Add subtitle
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#7f8c8d')
        .text('Percentage of total US resource consumption affected by food waste');
    
    // Create axes with styling
    const xAxis = d3.axisBottom(x)
        .tickSize(0)
        .tickPadding(15);
    
    const yAxis = d3.axisLeft(y)
        .ticks(4)
        .tickFormat(d => d + '%')
        .tickSize(-innerWidth);
    
    // Add grid lines
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis)
        .selectAll('line')
        .style('stroke', '#ecf0f1')
        .style('stroke-width', 1);
    
    // Add y-axis
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis)
        .selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#7f8c8d');
    
    // Remove y-axis domain line
    svg.select('.domain').remove();
    
    // Add bars with enhanced animation
    const bars = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.category))
        .attr('y', innerHeight)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('fill', (d, i) => `url(#gradient-${i})`)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('transform', 'scale(1.02)');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            tooltip.html(`
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 5px;">${d.icon}</div>
                    <strong>${d.category}</strong><br/>
                    <span style="font-size: 18px; color: ${d.color}; font-weight: bold;">${d.percentage}%</span><br/>
                    <span style="font-size: 14px; margin: 5px 0; display: block;">${d.absoluteValue}</span>
                    <span style="font-size: 11px; opacity: 0.9; font-style: italic;">${d.description}</span>
                </div>
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('transform', 'scale(1)');
            
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
    
    // Animate bars
    bars.transition()
        .delay((d, i) => i * 150)
        .duration(1000)
        .ease(d3.easeBounceOut)
        .attr('y', d => y(d.percentage))
        .attr('height', d => innerHeight - y(d.percentage));
    
    // Add value labels with icons
    const labelGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    data.forEach((d, i) => {
        // Add icon above bar
        labelGroup.append('text')
            .attr('x', x(d.category) + x.bandwidth() / 2)
            .attr('y', y(d.percentage) - 35)
            .attr('text-anchor', 'middle')
            .style('font-size', '20px')
            .style('opacity', 0)
            .text(d.icon)
            .transition()
            .delay(i * 150 + 1000)
            .duration(500)
            .style('opacity', 1);
        
        // Add percentage label
        labelGroup.append('text')
            .attr('x', x(d.category) + x.bandwidth() / 2)
            .attr('y', y(d.percentage) - 15)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', d.color)
            .style('opacity', 0)
            .text(d.percentage + '%')
            .transition()
            .delay(i * 150 + 1200)
            .duration(500)
            .style('opacity', 1);
    });
    
    // Add x-axis with wrapped labels
    const xAxisGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top + innerHeight})`)
        .call(xAxis);
    
    xAxisGroup.selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#7f8c8d')
        .style('font-weight', '500')
        .each(function() {
            const text = d3.select(this);
            const words = text.text().split(' ');
            text.text('');
            
            words.forEach((word, i) => {
                text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', i === 0 ? '0.8em' : '1.2em')
                    .text(word);
            });
        });
    
    // Remove x-axis domain line
    xAxisGroup.select('.domain').remove();
}

function initSolutionsChart() {
    const container = d3.select('#waste-solutions-chart');
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 550;
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Enhanced data with multiple solution scenarios
    const timePoints = ['Month 1', 'Month 6', 'Month 12', 'Month 18', 'Month 24', 'Month 36'];
    
    const scenarioData = [
        {
            name: 'Smart Shopping & Planning',
            color: '#3498db',
            icon: '📝',
            values: [2, 8, 15, 22, 28, 30],
            description: 'Meal planning, shopping lists, portion control'
        },
        {
            name: 'Proper Food Storage',
            color: '#27ae60',
            icon: '🥫',
            values: [3, 12, 20, 26, 32, 35],
            description: 'Temperature control, container usage, rotation'
        },
        {
            name: 'Composting & Recovery',
            color: '#e74c3c',
            icon: '♻️',
            values: [1, 5, 10, 15, 20, 25],
            description: 'Food rescue, composting, redistribution'
        },
        {
            name: 'Technology Solutions',
            color: '#9b59b6',
            icon: '📱',
            values: [1, 6, 12, 18, 25, 28],
            description: 'Apps, smart packaging, expiration tracking'
        },
        {
            name: 'Combined Approach',
            color: '#f39c12',
            icon: '🎯',
            values: [5, 18, 32, 45, 55, 60],
            description: 'Implementing all strategies together'
        }
    ];
    
    const margin = { top: 80, right: 120, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create scales
    const x = d3.scalePoint()
        .domain(timePoints)
        .range([0, innerWidth])
        .padding(0.1);
    
    const y = d3.scaleLinear()
        .domain([0, 70])
        .range([innerHeight, 0]);
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'solutions-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000);
    
    // Add title and subtitle
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '22px')
        .style('font-weight', 'bold')
        .style('fill', '#2c3e50')
        .text('Food Waste Reduction Strategies');
    
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#7f8c8d')
        .text('Projected waste reduction over time with different approaches');
    
    // Create axes with styling
    const xAxis = d3.axisBottom(x)
        .tickSize(0)
        .tickPadding(15);
    
    const yAxis = d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d => d + '%')
        .tickSize(-innerWidth);
    
    // Add grid lines
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis)
        .selectAll('line')
        .style('stroke', '#ecf0f1')
        .style('stroke-width', 1);
    
    // Add axes
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis)
        .selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#7f8c8d');
    
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top + innerHeight})`)
        .call(xAxis)
        .selectAll('text')
        .style('font-size', '12px')
        .style('fill', '#7f8c8d');
    
    // Remove domain lines
    svg.selectAll('.domain').remove();
    
    // Create line generator
    const line = d3.line()
        .x((d, i) => x(timePoints[i]))
        .y(d => y(d))
        .curve(d3.curveCardinal);
    
    // Add lines for each scenario
    const chartGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    scenarioData.forEach((scenario, scenarioIndex) => {
        // Add line path
        const path = chartGroup.append('path')
            .datum(scenario.values)
            .attr('fill', 'none')
            .attr('stroke', scenario.color)
            .attr('stroke-width', 3)
            .attr('opacity', 0.8)
            .attr('d', line)
            .style('cursor', 'pointer');
        
        // Animate line drawing
        const totalLength = path.node().getTotalLength();
        path
            .attr('stroke-dasharray', totalLength + ' ' + totalLength)
            .attr('stroke-dashoffset', totalLength)
            .transition()
            .delay(scenarioIndex * 200)
            .duration(1500)
            .attr('stroke-dashoffset', 0);
        
        // Add hover effects to line
        path.on('mouseover', function() {
            d3.select(this)
                .attr('stroke-width', 5)
                .attr('opacity', 1);
        })
        .on('mouseout', function() {
            d3.select(this)
                .attr('stroke-width', 3)
                .attr('opacity', 0.8);
        });
        
        // Add data points
        chartGroup.selectAll(`.dots-${scenarioIndex}`)
            .data(scenario.values)
            .enter()
            .append('circle')
            .attr('class', `dots-${scenarioIndex}`)
            .attr('cx', (d, i) => x(timePoints[i]))
            .attr('cy', d => y(d))
            .attr('r', 6)
            .attr('fill', scenario.color)
            .attr('stroke', '#333')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .style('opacity', 0)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', 8);
                
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 1);
                
                const index = scenario.values.indexOf(d);
                tooltip.html(`
                    <div style="text-align: center;">
                        <div style="font-size: 16px; margin-bottom: 5px;">${scenario.icon}</div>
                        <strong>${scenario.name}</strong><br/>
                        <span style="color: ${scenario.color}; font-weight: bold;">${d}% reduction</span><br/>
                        <span style="font-size: 11px;">at ${timePoints[index]}</span><br/>
                        <span style="font-size: 10px; opacity: 0.8; font-style: italic;">${scenario.description}</span>
                    </div>
                `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', 6);
                
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            })
            .transition()
            .delay(scenarioIndex * 200 + 1000)
            .duration(800)
            .style('opacity', 1);
    });
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${width - margin.right + 10}, ${margin.top + 20})`);
    
    scenarioData.forEach((scenario, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 25})`)
            .style('cursor', 'pointer');
        
        // Legend line
        legendItem.append('line')
            .attr('x1', 0)
            .attr('x2', 20)
            .attr('y1', 0)
            .attr('y2', 0)
            .attr('stroke', scenario.color)
            .attr('stroke-width', 3);
        
        // Legend dot
        legendItem.append('circle')
            .attr('cx', 10)
            .attr('cy', 0)
            .attr('r', 4)
            .attr('fill', scenario.color)
            .attr('stroke', '#333')
            .attr('stroke-width', 1);
        
        // Legend text
        legendItem.append('text')
            .attr('x', 25)
            .attr('y', 0)
            .attr('dy', '0.35em')
            .style('font-size', '11px')
            .style('fill', '#2c3e50')
            .text(`${scenario.icon} ${scenario.name}`);
        
        // Legend hover effects
        legendItem.on('mouseover', function() {
            chartGroup.selectAll('path')
                .attr('opacity', 0.2);
            chartGroup.selectAll(`.dots-${i}`)
                .attr('opacity', 0.2);
            
            chartGroup.selectAll('path')
                .filter((d, index) => index === i)
                .attr('opacity', 1)
                .attr('stroke-width', 5);
            chartGroup.selectAll(`.dots-${i}`)
                .attr('opacity', 1);
        })
        .on('mouseout', function() {
            chartGroup.selectAll('path')
                .attr('opacity', 0.8)
                .attr('stroke-width', 3);
            chartGroup.selectAll('circle')
                .attr('opacity', 1);
        });
    });
    
    // Add goal line
    chartGroup.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y(50))
        .attr('y2', y(50))
        .attr('stroke', '#e74c3c')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.7);
    
    chartGroup.append('text')
        .attr('x', innerWidth - 5)
        .attr('y', y(50) - 5)
        .attr('text-anchor', 'end')
        .style('font-size', '11px')
        .style('fill', '#e74c3c')
        .style('font-weight', 'bold')
        .text('Target: 50% reduction');
}

function initImpactChart() {
    const container = d3.select('#waste-impact-chart');
    if (container.empty()) return;
    
    // Clear any existing content
    container.selectAll('*').remove();
    
    const width = container.node().getBoundingClientRect().width || 400;
    const height = 550;
    
    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);
    
    // Enhanced economic impact data
    const data = [
        { 
            category: 'Household Impact', 
            currentCost: 1500, 
            potentialSavings: 700,
            icon: '🏠',
            description: 'Average annual cost per household',
            color: '#e74c3c'
        },
        { 
            category: 'Healthcare Costs', 
            currentCost: 890, 
            potentialSavings: 400,
            icon: '🏥',
            description: 'Food insecurity-related health expenses',
            color: '#3498db'
        },
        { 
            category: 'Environmental Cleanup', 
            currentCost: 2100, 
            potentialSavings: 1200,
            icon: '🌍',
            description: 'Climate and environmental mitigation costs',
            color: '#27ae60'
        },
        { 
            category: 'Business Losses', 
            currentCost: 1800, 
            potentialSavings: 900,
            icon: '🏢',
            description: 'Corporate waste management and lost revenue',
            color: '#f39c12'
        },
        { 
            category: 'Infrastructure', 
            currentCost: 950, 
            potentialSavings: 480,
            icon: '🚛',
            description: 'Transportation and disposal infrastructure',
            color: '#9b59b6'
        }
    ];
    
    const margin = { top: 80, right: 60, bottom: 100, left: 90 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Create scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.category))
        .range([0, innerWidth])
        .padding(0.2);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.currentCost) * 1.1])
        .range([innerHeight, 0]);
    
    // Create tooltip
    const tooltip = d3.select('body').append('div')
        .attr('class', 'impact-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '15px')
        .style('border-radius', '8px')
        .style('font-size', '13px')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('z-index', 1000)
        .style('max-width', '300px');
    
    // Add title and subtitle
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '22px')
        .style('font-weight', 'bold')
        .style('fill', '#2c3e50')
        .text('Economic Impact & Savings Potential');
    
    svg.append('text')
        .attr('x', width/2)
        .attr('y', 45)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#7f8c8d')
        .text('Annual costs per household and potential savings from waste reduction');
    
    // Create gradient definitions for bars
    const defs = svg.append('defs');
    data.forEach((d, i) => {
        // Gradient for current cost bars
        const costGradient = defs.append('linearGradient')
            .attr('id', `cost-gradient-${i}`)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', 0).attr('y1', innerHeight)
            .attr('x2', 0).attr('y2', 0);
        
        costGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', d.color)
            .attr('stop-opacity', 0.8);
        
        costGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', d.color)
            .attr('stop-opacity', 1);
        
        // Gradient for savings bars
        const savingsGradient = defs.append('linearGradient')
            .attr('id', `savings-gradient-${i}`)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', 0).attr('y1', innerHeight)
            .attr('x2', 0).attr('y2', 0);
        
        savingsGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', '#2ecc71')
            .attr('stop-opacity', 0.6);
        
        savingsGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', '#27ae60')
            .attr('stop-opacity', 0.8);
    });
    
    // Create axes with styling
    const xAxis = d3.axisBottom(x)
        .tickSize(0)
        .tickPadding(15);
    
    const yAxis = d3.axisLeft(y)
        .ticks(4)
        .tickFormat(d => '$' + d3.format(',')(d))
        .tickSize(-innerWidth);
    
    // Add grid lines
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis)
        .selectAll('line')
        .style('stroke', '#ecf0f1')
        .style('stroke-width', 1);
    
    // Add y-axis
    svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`)
        .call(yAxis)
        .selectAll('text')
        .style('font-size', '10px')
        .style('fill', '#7f8c8d');
    
    // Remove y-axis domain line
    svg.select('.domain').remove();
    
    const chartGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    // Add current cost bars
    const costBars = chartGroup.selectAll('.cost-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'cost-bar')
        .attr('x', d => x(d.category))
        .attr('y', innerHeight)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('fill', (d, i) => `url(#cost-gradient-${i})`)
        .attr('rx', 4)
        .attr('ry', 4)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('transform', 'scale(1.02)');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            tooltip.html(`
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 8px;">${d.icon}</div>
                    <strong>${d.category}</strong><br/>
                    <div style="margin: 8px 0;">
                        <span style="color: ${d.color}; font-weight: bold;">Current Cost: $${d.currentCost}</span><br/>
                        <span style="color: #27ae60; font-weight: bold;">Potential Savings: $${d.potentialSavings}</span>
                    </div>
                    <span style="font-size: 11px; opacity: 0.9; font-style: italic;">${d.description}</span>
                </div>
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('transform', 'scale(1)');
            
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
    
    // Add savings bars (overlaid)
    const savingsBars = chartGroup.selectAll('.savings-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'savings-bar')
        .attr('x', d => x(d.category) + x.bandwidth() * 0.1)
        .attr('y', innerHeight)
        .attr('width', x.bandwidth() * 0.8)
        .attr('height', 0)
        .attr('fill', (d, i) => `url(#savings-gradient-${i})`)
        .attr('rx', 3)
        .attr('ry', 3)
        .style('cursor', 'pointer')
        .on('mouseover', function(event, d) {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('transform', 'scale(1.02)');
            
            tooltip.transition()
                .duration(200)
                .style('opacity', 1);
            
            const savingsPercentage = ((d.potentialSavings / d.currentCost) * 100).toFixed(0);
            tooltip.html(`
                <div style="text-align: center;">
                    <div style="font-size: 20px; margin-bottom: 8px;">💰</div>
                    <strong>Potential Savings</strong><br/>
                    <span style="color: #27ae60; font-weight: bold; font-size: 16px;">$${d.potentialSavings}</span><br/>
                    <span style="font-size: 12px;">(${savingsPercentage}% reduction in ${d.category})</span><br/>
                    <span style="font-size: 11px; opacity: 0.9; margin-top: 5px; display: block;">Through effective waste reduction strategies</span>
                </div>
            `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function() {
            d3.select(this)
                .transition()
                .duration(200)
                .attr('transform', 'scale(1)');
            
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
        });
    
    // Animate cost bars
    costBars.transition()
        .delay((d, i) => i * 150)
        .duration(1000)
        .ease(d3.easeBounceOut)
        .attr('y', d => y(d.currentCost))
        .attr('height', d => innerHeight - y(d.currentCost));
    
    // Animate savings bars
    savingsBars.transition()
        .delay((d, i) => i * 150 + 500)
        .duration(1000)
        .ease(d3.easeBounceOut)
        .attr('y', d => y(d.potentialSavings))
        .attr('height', d => innerHeight - y(d.potentialSavings));
    
    // Add value labels
    data.forEach((d, i) => {
        // Current cost labels
        chartGroup.append('text')
            .attr('x', x(d.category) + x.bandwidth() / 2)
            .attr('y', y(d.currentCost) - 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('fill', d.color)
            .style('opacity', 0)
            .text('$' + d.currentCost)
            .transition()
            .delay(i * 150 + 1000)
            .duration(500)
            .style('opacity', 1);
        
        // Savings labels
        chartGroup.append('text')
            .attr('x', x(d.category) + x.bandwidth() / 2)
            .attr('y', y(d.potentialSavings) - 5)
            .attr('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('font-weight', 'bold')
            .style('fill', '#27ae60')
            .style('opacity', 0)
            .text('Save $' + d.potentialSavings)
            .transition()
            .delay(i * 150 + 1500)
            .duration(500)
            .style('opacity', 1);
        
        // Icon labels
        chartGroup.append('text')
            .attr('x', x(d.category) + x.bandwidth() / 2)
            .attr('y', y(d.currentCost) - 45)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('opacity', 0)
            .text(d.icon)
            .transition()
            .delay(i * 150 + 800)
            .duration(500)
            .style('opacity', 1);
    });
    
    // Add x-axis with wrapped labels
    const xAxisGroup = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top + innerHeight})`)
        .call(xAxis);
    
    xAxisGroup.selectAll('text')
        .style('font-size', '11px')
        .style('fill', '#7f8c8d')
        .style('font-weight', '500')
        .each(function() {
            const text = d3.select(this);
            const words = text.text().split(' ');
            text.text('');
            
            words.forEach((word, i) => {
                text.append('tspan')
                    .attr('x', 0)
                    .attr('dy', i === 0 ? '0.8em' : '1.2em')
                    .text(word);
            });
        });
    
    // Remove x-axis domain line
    xAxisGroup.select('.domain').remove();
    
    // Add legend
    const legend = svg.append('g')
        .attr('transform', `translate(${margin.left}, ${height - 45})`);
    
    legend.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', '#e74c3c')
        .attr('rx', 2);
    
    legend.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .style('font-size', '12px')
        .style('fill', '#2c3e50')
        .text('Current Annual Cost');
    
    legend.append('rect')
        .attr('x', 180)
        .attr('y', 0)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', '#27ae60')
        .attr('rx', 2);
    
    legend.append('text')
        .attr('x', 200)
        .attr('y', 12)
        .style('font-size', '12px')
        .style('fill', '#2c3e50')
        .text('Potential Savings');
}

// top k sub-sectors/food types
const k = 5;

async function drawFoodWasteBySubSectorBar({ year = 2023, state = '', operationId = null } = {}) {
  const { wasteData } = await loadGlobalData();
  
  // Check if operation was cancelled after async operation
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Filter for year
  let filtered = wasteData.filter(d => d.year === +year);
  // Filter for state if provided
  if (state) filtered = filtered.filter(d => d.state === state);
  // Group by sub_sector, using sector if Not Applicable
  const grouped = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.tons_waste),
    d => d.sub_sector === 'Not Applicable' ? d.sector : d.sub_sector
  );
  grouped.sort((a, b) => b[1] - a[1]);
  const top5 = grouped.slice(0, k);
  
  // Check if operation was cancelled before DOM updates
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Set up SVG
  const container = d3.select('#d3-plot-top');
  container.selectAll('*').remove();
  const width = 360, height = 180, margin = {left: 120, right: 20, top: 28, bottom: 48};
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);
  // Y scale (categories)
  const y = d3.scaleBand()
    .domain(top5.map(d => d[0]))
    .range([margin.top, height - margin.bottom])
    .padding(0.15);
  // X scale (millions of tons)
  const x = d3.scaleLinear()
    .domain([0, d3.max(top5, d => d[1] / 1e6)])
    .nice()
    .range([margin.left, width - margin.right]);
  // Tooltip div (one global for this chart)
  let tooltip = d3.select('#d3-plot-top-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('id', 'd3-plot-top-tooltip')
      .attr('class', 'tooltip')
      .style('padding', '10px')
      .style('min-width', '0px')
      .style('position', 'absolute')
      .style('display', 'none');
  }
  // Bars
  const bars = svg.append('g')
    .selectAll('rect')
    .data(top5)
    .join('rect')
    .attr('x', x(0))
    .attr('y', d => y(d[0]))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('fill', '#e67e22')
    .on('mousemove', function(event, d) {
      tooltip
        .style('display', 'block')
        .html(`<strong>${d[0]}</strong><br><span class="red-number">${d3.format(',.2f')(d[1])} tons</span>`)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 24) + 'px');
      d3.select(this).attr('fill', '#b35413');
    })
    .on('mouseleave', function() {
      tooltip.style('display', 'none');
      d3.select(this).attr('fill', '#e67e22');
    });

  bars.transition()
    .duration(800)
    .attr('width', d => x(d[1] / 1e6) - x(0));

  // Y axis
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .call(d3.axisLeft(y))
    .selectAll('text')
    .style('font-size', '13px');
  // X axis (millions)
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).ticks(k).tickFormat(d => d3.format(',.1f')(d)))
    .selectAll('text')
    .style('font-size', '12px');
  // X axis label
  svg.append('text')
    .attr('x', (width + margin.left) / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .text('Millions of Tons');
  
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 15)
    .attr('text-anchor', 'middle')
    .attr('font-size', '15px')
    .attr('font-weight', 600)
    .text(`Top 5 Most Wasteful Sub-Sectors`);
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 3) // 20px below the previous line
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .attr('font-weight', 400)
    .text(state ? `(${state}, ${year})` : `(US, ${year})`);
}

async function drawFoodWasteByFoodTypeBar({ year = 2023, state = '', operationId = null } = {}) {
  const { wasteData } = await loadGlobalData();
  
  // Check if operation was cancelled after async operation
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Filter for year
  let filtered = wasteData.filter(d => d.year === +year);
  // Filter for state if provided
  if (state) filtered = filtered.filter(d => d.state === state);
  // Group by food_type
  const grouped = d3.rollups(
    filtered,
    v => d3.sum(v, d => d.tons_waste),
    d => d.food_type
  );
  grouped.sort((a, b) => b[1] - a[1]);
  const top5 = grouped.slice(0, k);
  
  // Check if operation was cancelled before DOM updates
  if (operationId && operationId !== currentOperationId) {
    return; // Cancel this operation
  }
  
  // Set up SVG
  const container = d3.select('#d3-plot-bottom');
  container.selectAll('*').remove();
  const width = 360, height = 180, margin = {left: 120, right: 20, top: 28, bottom: 48};
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);
  // Y scale (categories)
  const y = d3.scaleBand()
    .domain(top5.map(d => d[0]))
    .range([margin.top, height - margin.bottom])
    .padding(0.15);
  // X scale (millions of tons)
  const x = d3.scaleLinear()
    .domain([0, d3.max(top5, d => d[1] / 1e6)])
    .nice()
    .range([margin.left, width - margin.right]);
  // Tooltip div (one global for this chart)
  let tooltip = d3.select('#d3-plot-bottom-tooltip');
  if (tooltip.empty()) {
    tooltip = d3.select('body').append('div')
      .attr('id', 'd3-plot-bottom-tooltip')
      .attr('class', 'tooltip')
      .style('padding', '10px')
      .style('min-width', '0px')
      .style('position', 'absolute')
      .style('display', 'none');
  }
  // Bars
  const bars = svg.append('g')
    .selectAll('rect')
    .data(top5)
    .join('rect')
    .attr('x', x(0))
    .attr('y', d => y(d[0]))
    .attr('width', 0)
    .attr('height', y.bandwidth())
    .attr('fill', '#3498db')
    .on('mousemove', function(event, d) {
      tooltip
        .style('display', 'block')
        .html(`<strong>${d[0]}</strong><br><span class="red-number">${d3.format(',.2f')(d[1])} tons</span>`)
        .style('left', (event.pageX + 12) + 'px')
        .style('top', (event.pageY - 24) + 'px');
      d3.select(this).attr('fill', '#1d5e8a');
    })
    .on('mouseleave', function() {
      tooltip.style('display', 'none');
      d3.select(this).attr('fill', '#3498db');
    });

    bars.transition()
      .duration(800)
      .attr('width', d => x(d[1] / 1e6) - x(0));

    // Y axis
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('font-size', '13px');
    // X axis (millions)
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(k).tickFormat(d => d3.format(',.1f')(d)))
      .selectAll('text')
      .style('font-size', '12px');
    // X axis label
    svg.append('text')
      .attr('x', (width + margin.left) / 2)
      .attr('y', height - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px')
      .text('Millions of Tons');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top - 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '15px')
      .attr('font-weight', 600)
      .text(`Top 5 Most Wasted Food Types`);
      svg.append('text')
    .attr('x', width / 2)
    .attr('y', margin.top - 3) // 20px below the previous line
    .attr('text-anchor', 'middle')
    .attr('font-size', '13px')
    .attr('font-weight', 400)
    .text(state ? `(${state}, ${year})` : `(US, ${year})`);
}

// Improved scroll-triggered background color transition
window.addEventListener('scroll', function() {
  const bgTransStart = document.getElementById('country-subtext-1');
  const bgTransEnd = document.getElementById('country-conclusion');
  if (!bgTransStart || !bgTransEnd) return;
  const start = bgTransStart.getBoundingClientRect();
  const end = bgTransEnd.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;

  // Calculate the scroll range for interpolation
  const startY = start.bottom + window.scrollY; // When the bottom of subtext1 leaves the top of viewport
  const endY = end.top + window.scrollY;      // When the top of map-container hits the top of viewport
  const scrollY = window.scrollY;

  // If before the range, keep white
  if (scrollY < startY) {
    document.body.style.transition = 'background 0.2s linear';
    document.body.style.background = '#fff';
    return;
  }
  // If after the range, keep blue
  if (scrollY > endY) {
    document.body.style.transition = 'background 0.2s linear';
    document.body.style.background = '#7e99d9';
    return;
  }
  // Interpolate color between white and #7e99d9
  let progress = (scrollY - startY) / (endY - startY);
  progress = Math.max(0, Math.min(1, progress));
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const num = parseInt(hex, 16);
    return [num >> 16, (num >> 8) & 255, num & 255];
  }
  const rgb1 = [255, 255, 255];
  const rgb2 = hexToRgb('7e99d9');
  const r = Math.round(lerp(rgb1[0], rgb2[0], progress));
  const g = Math.round(lerp(rgb1[1], rgb2[1], progress));
  const b = Math.round(lerp(rgb1[2], rgb2[2], progress));
  document.body.style.transition = 'background 0.2s linear';
  document.body.style.background = `rgb(${r},${g},${b})`;
});

// Performance improvement: operation cancellation system
let currentOperationId = 0;

// Fullscreen functionality
function toggleFullscreen(type) {
    const fullscreenContainer = document.getElementById(`${type}-fullscreen`);
    const chartContainer = document.getElementById(`waste-${type}-chart`);
    const fullscreenChart = document.getElementById(`${type}-fullscreen-chart`);
    
    if (fullscreenContainer.style.display === 'flex') {
        // Exit fullscreen
        fullscreenContainer.style.display = 'none';
        document.body.style.overflow = 'auto';
    } else {
        // Enter fullscreen
        fullscreenContainer.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Clone the visualization to the fullscreen container
        const originalChart = chartContainer.querySelector('svg');
        if (originalChart) {
            const clonedChart = originalChart.cloneNode(true);
            fullscreenChart.innerHTML = '';
            fullscreenChart.appendChild(clonedChart);
            
            // Resize the chart to fit the fullscreen container
            const width = fullscreenChart.clientWidth;
            const height = fullscreenChart.clientHeight;
            
            // Update the chart dimensions
            clonedChart.setAttribute('width', width);
            clonedChart.setAttribute('height', height);
            
            // Reinitialize the visualization with new dimensions
            switch(type) {
                case 'causes':
                    initCausesChart(clonedChart, width, height);
                    break;
                case 'effects':
                    initEffectsChart(clonedChart, width, height);
                    break;
                case 'solutions':
                    initSolutionsChart(clonedChart, width, height);
                    break;
                case 'impact':
                    initImpactChart(clonedChart, width, height);
                    break;
            }
        }
    }
}

// Add resize handler for fullscreen visualizations
window.addEventListener('resize', () => {
    const fullscreenContainers = document.querySelectorAll('.visualization-fullscreen');
    fullscreenContainers.forEach(container => {
        if (container.style.display === 'flex') {
            const type = container.id.split('-')[0];
            const chart = container.querySelector('svg');
            if (chart) {
                const width = container.querySelector('.fullscreen-content').clientWidth;
                const height = container.querySelector('.fullscreen-content').clientHeight;
                
                chart.setAttribute('width', width);
                chart.setAttribute('height', height);
                
                // Reinitialize the visualization with new dimensions
                switch(type) {
                    case 'causes':
                        initCausesChart(chart, width, height);
                        break;
                    case 'effects':
                        initEffectsChart(chart, width, height);
                        break;
                    case 'solutions':
                        initSolutionsChart(chart, width, height);
                        break;
                    case 'impact':
                        initImpactChart(chart, width, height);
                        break;
                }
            }
        }
    });
});

// Add escape key handler for fullscreen
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const fullscreenContainers = document.querySelectorAll('.visualization-fullscreen');
        fullscreenContainers.forEach(container => {
            if (container.style.display === 'flex') {
                container.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }
});

// Reveal post-map sections with animation as they enter the viewport
function setupRevealSections() {
  const revealSections = document.querySelectorAll('.reveal-section');
  const observer = new window.IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Stagger child animations for .reveal-stagger
        const staggerItems = entry.target.querySelectorAll('.reveal-stagger');
        staggerItems.forEach((item, i) => {
          setTimeout(() => item.classList.add('visible'), i * 120);
        });
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, {
    threshold: 0.18
  });
  revealSections.forEach(section => observer.observe(section));
}



