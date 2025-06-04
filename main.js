async function drawFoodWasteMap2023() {
  // Load US states GeoJSON
  const geoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';
  const us = await d3.json(geoUrl);

  // Load CSV and filter for 2023
  const data = await d3.csv('data/wastebyyear.csv', d => {
  // const data = await d3.csv('https://raw.githubusercontent.com/vdanielb/FoodWasteWatch/main/data/wastebyyear.csv', d => {
    d.year = +d.year;
    d.tons_waste = +d.tons_waste;
    return d;
  });
  const data2023 = data.filter(d => d.year === 2023);

  // 2023 US Census state population estimates (July 1, 2023)
  const statePop2023 = {
    "Alabama": 5074296,
    "Alaska": 733406,
    "Arizona": 7359191,
    "Arkansas": 3045637,
    "California": 38918045,
    "Colorado": 5912064,
    "Connecticut": 3605944,
    "Delaware": 1045631,
    "District of Columbia": 678972,
    "Florida": 22377446,
    "Georgia": 11015963,
    "Hawaii": 1427539,
    "Idaho": 1942571,
    "Illinois": 12582032,
    "Indiana": 6842384,
    "Iowa": 3205690,
    "Kansas": 2934582,
    "Kentucky": 4546607,
    "Louisiana": 4569031,
    "Maine": 1396966,
    "Maryland": 6195295,
    "Massachusetts": 6981974,
    "Michigan": 10061863,
    "Minnesota": 5737914,
    "Mississippi": 2918320,
    "Missouri": 6168187,
    "Montana": 1103349,
    "Nebraska": 1961504,
    "Nevada": 3235251,
    "New Hampshire": 1388992,
    "New Jersey": 9261692,
    "New Mexico": 2115252,
    "New York": 19453561,
    "North Carolina": 10701022,
    "North Dakota": 779261,
    "Ohio": 11780017,
    "Oklahoma": 4019800,
    "Oregon": 4237256,
    "Pennsylvania": 12801989,
    "Rhode Island": 1097379,
    "South Carolina": 5321610,
    "South Dakota": 909824,
    "Tennessee": 7092654,
    "Texas": 30439188,
    "Utah": 3402027,
    "Vermont": 647156,
    "Virginia": 8683619,
    "Washington": 7715946,
    "West Virginia": 1778070,
    "Wisconsin": 5893718,
    "Wyoming": 586485
  };

  // Aggregate tons_waste by state (per 10,000 people)
  const wasteByState = d3.rollup(
    data2023,
    v => {
      const state = v[0].state;
      const pop = statePop2023[state];
      if (!pop) return null;
      const totalWaste = d3.sum(v, d => d.tons_waste);
      return totalWaste / (pop / 10000); // tons per 10,000 people
    },
    d => d.state
  );

  // Map state names to postal codes for GeoJSON
  // us-atlas uses state FIPS codes, so we need a mapping
  const width = 960, height = 500;
  d3.select('#map').selectAll('*').remove();
  const svg = d3.select('#map').append('svg')
    .attr('width', width)
    .attr('height', height);

  // use d3.geoPath and d3.geoAlbersUsa for projection
  const projection = d3.geoAlbersUsa().fitSize([width, height], topojson.feature(us, us.objects.states));
  const path = d3.geoPath().projection(projection);

  // Get FIPS to state name mapping
  const stateIdToName = new Map([
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

  // Compute color scale
  const values = Array.from(wasteByState.values());
  const color = d3.scaleSequential()
    .domain([d3.min(values), d3.max(values)])
    .interpolator(d3.interpolateYlOrRd);

  // Draw states
  const g = svg.append('g');
  const states = g
    .selectAll('path')
    .data(topojson.feature(us, us.objects.states).features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = stateIdToName.get(fips);
      const waste = wasteByState.get(stateName);
      return waste ? color(waste) : '#eee';
    })
    .attr('stroke', '#000')
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mouseover', function(event, d) {
      const fips = d.id.toString().padStart(2, '0');
      const stateName = stateIdToName.get(fips);
      const waste = wasteByState.get(stateName);

      // Filter and group by food_type for this state
      const stateFoodData = data2023.filter(row => row.state === stateName);
      const foodTypeTotals = d3.rollups(
        stateFoodData,
        v => d3.sum(v, d => d.tons_waste),
        d => d.food_type
      );

      // Tooltip HTML
      let html = `<strong>${stateName}</strong><br/>${waste ? waste.toLocaleString(undefined, {maximumFractionDigits: 2}) : 'No data'} tons per 10,000 people`;
      html += `<div id="tooltip-barchart" style="display: flex; justify-content: center; align-items: center; margin-top: 10px;"></div>`;
      tooltip.style('display', 'block').html(html);

      // Draw the bar chart using D3
      setTimeout(() => {
        const width = 360, height = 180, margin = {left: 70, right: 10, top: 10, bottom: 60};
        const svg = d3.select('#tooltip-barchart')
          .append('svg')
          .attr('width', width)
          .attr('height', height)
          .style('margin', 'auto')
          .style('display', 'block');

        const x = d3.scaleBand()
          .domain(foodTypeTotals.map(d => d[0]))
          .range([margin.left, width - margin.right])
          .padding(0.1);

        const y = d3.scaleLinear()
          .domain([0, d3.max(foodTypeTotals, d => d[1])])
          .nice()
          .range([height - margin.bottom, margin.top]);

        svg.append('g')
          .selectAll('rect')
          .data(foodTypeTotals)
          .join('rect')
          .attr('x', d => x(d[0]))
          .attr('y', d => y(d[1]))
          .attr('height', d => y(0) - y(d[1]))
          .attr('width', x.bandwidth())
          .attr('fill', '#69b3a2');

        svg.append('g')
          .attr('transform', `translate(0,${height - margin.bottom})`)
          .call(d3.axisBottom(x).tickSizeOuter(0))
          .selectAll('text')
          .attr('transform', 'rotate(-40)')
          .style('text-anchor', 'end');

        svg.append('g')
          .attr('transform', `translate(${margin.left},0)`)
          .call(d3.axisLeft(y).ticks(4));
      }, 0);
    })
    .on('mousemove', function(event) {
      tooltip.style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      tooltip.style('display', 'none');
    })
    .on('click', function(event, d) {
      const isZoomed = d3.select(this).classed('zoomed');
      if (isZoomed) {
        g.transition().duration(750).attr('transform', null);
        states.transition().duration(750).style('opacity', 1).classed('zoomed', false);
      } else {
        const [[x0, y0], [x1, y1]] = path.bounds(d);
        const dx = x1 - x0;
        const dy = y1 - y0;
        const x = (x0 + x1) / 2;
        const y = (y0 + y1) / 2;
        const scale = Math.max(1, Math.min(8, 0.8 / Math.max(dx / width, dy / height)));
        const translate = [width / 2 - scale * x, height / 2 - scale * y];
        g.transition().duration(750)
          .attr('transform', `translate(${translate[0]},${translate[1]}) scale(${scale})`);
        states.transition().duration(750)
          .style('opacity', s => (s === d ? 1 : 0.2))
          .classed('zoomed', s => s === d);
      }
    });

  // Add reset view button functionality
  d3.select('#resetView').on('click', function() {
    g.transition().duration(750).attr('transform', null);
    states.transition().duration(750).style('opacity', 1).classed('zoomed', false);
  });

  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('display', 'none');
}

function animateFoodWasteFalling(containerId) {
  const container = d3.select(containerId);
  container.selectAll('*').remove();
  const width = 400, height = 400; // Larger size to match container
  const svg = container.append('svg')
    .attr('width', width)
    .attr('height', height);

  // Draw ground/pile base - much wider
  svg.append('ellipse')
    .attr('cx', width/2)
    .attr('cy', height-50)
    .attr('rx', 160) // Much wider pile area
    .attr('ry', 35) // Slightly taller as well
    .attr('fill', '#b5a27a');

  // Trash-like colors for circles
  const trashColors = [
    '#b5a27a', '#e0e0e0', '#7fd3e6', '#a3c586', '#f5e6c8', '#b0b0b0',
    '#fffbe6', '#ffe066', '#e74c3c', '#6a7b8c', '#e2b07a', '#e0f7fa'
  ];

  function dropCircle() {
    const x = width/2 + (Math.random()-0.5)*180; // Even wider spread to match the pile
    const r = 8 + Math.random()*12; // Larger circles
    const color = trashColors[Math.floor(Math.random()*trashColors.length)];
    const g = svg.append('g').attr('class', 'falling-circle');
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', r)
      .attr('fill', color)
      .attr('opacity', 0.95);
    g.attr('transform', `translate(${x},-30)`);
    
    g.transition()
      .duration(1600) // Slightly slower for better visual impact
      .ease(d3.easeBounce)
      .attr('transform', `translate(${x},${height-60-Math.random()*25})`)
      .on('end', function() {
        d3.select(this).style('opacity', 1);
      });
  }

  return setInterval(dropCircle, 400); // More frequent drops for larger space
}

// Function to handle layered scrolling text boxes
function initLayeredScrolling() {
  const scrollContainer = document.getElementById('scrolly-foodwaste');
  const textBoxes = document.querySelectorAll('.moving-text-box');
  
  function updateTextBoxPositions() {
    const scrollTop = window.pageYOffset;
    const containerTop = scrollContainer.offsetTop;
    const containerHeight = scrollContainer.offsetHeight;
    const progress = Math.max(0, Math.min(1, (scrollTop - containerTop) / (containerHeight * 0.8)));
    
    textBoxes.forEach((box, index) => {
      // Each text box appears at different scroll progress points
      const startProgress = index * 0.3; // 0, 0.3, 0.6 - more spacing between boxes
      const endProgress = startProgress + 0.4; // Duration of visibility
      
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
          } else if (index === 1) {
            updateFoodVisualization('month');
            updateTrashSummary('month');
          } else if (index === 2) {
            updateFoodVisualization('year');
            updateTrashSummary('year');
          }
        }
        
        // Also update during the main visibility period to ensure sync
        if (boxProgress >= 0.15 && boxProgress <= 0.85) {
          if (index === 0 && currentFoodVisualization !== 'day') {
            updateFoodVisualization('day');
            updateTrashSummary('day');
          } else if (index === 1 && currentFoodVisualization !== 'month') {
            updateFoodVisualization('month');
            updateTrashSummary('month');
          } else if (index === 2 && currentFoodVisualization !== 'year') {
            updateFoodVisualization('year');
            updateTrashSummary('year');
          }
        }
        
        // Fade effects at edges
        if (boxProgress < 0.1 || boxProgress > 0.9) {
          box.style.opacity = 0.4;
        }
      } else if (progress > endProgress) {
        // Box has passed through - position above screen
        box.style.top = '-20vh';
        box.style.opacity = 0;
        box.classList.remove('active');
        box.classList.add('passing');
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

document.addEventListener('DOMContentLoaded', function() {
  drawFoodWasteMap2023();
  
  // Create single fixed trash animation
  const trashAnimation = animateFoodWasteFalling('#fixed-trash-animation');

  // --- Food waste scrollytelling calculations and visuals ---
  d3.csv('data/wastebyyear.csv', d => {
    d.year = +d.year;
    d.tons_waste = +d.tons_waste;
    return d;
  }).then(data => {
    // Filter for 2023
    const data2023 = data.filter(d => d.year === 2023);
    // Get state populations from main.js
    const statePop2023 = {
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
    // Sum total waste and population
    let totalTons = 0;
    let totalPop = 0;
    for (const state of Object.keys(statePop2023)) {
      const stateWaste = data2023.filter(d => d.state === state);
      totalTons += d3.sum(stateWaste, d => d.tons_waste);
      totalPop += statePop2023[state];
    }
    const totalLbs = totalTons * 2000;
    const perPersonYear = totalLbs / totalPop;
    const perPersonDay = perPersonYear / 365;
    const perPersonMonth = perPersonDay * 30;
    // Round for display
    const r = x => Math.round(x);
    
    // Store values globally for content changes
    window.foodWasteData = {
      day: r(perPersonDay),
      month: r(perPersonMonth),
      year: r(perPersonYear)
    };
    
    // Populate the text boxes with calculated values
    document.getElementById('day-number').textContent = window.foodWasteData.day;
    document.getElementById('month-number').textContent = window.foodWasteData.month;
    document.getElementById('year-number').textContent = window.foodWasteData.year;
    
    // Initialize both visualizations with day data
    currentFoodVisualization = null; // Reset to ensure updates work
    currentTrashSummary = null; // Reset to ensure updates work
    updateFoodVisualization('day');
    updateTrashSummary('day');
    
    // Initialize layered scrolling system
    initLayeredScrolling();
  });
});

// Global variable to track current food visualization and prevent rapid switching
let currentFoodVisualization = null;
let currentTrashSummary = null;
let isAnimating = false;

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
      let applesSVG = '';
      const applesPerRow = 8; // More apples per row for larger space
      const appleRows = Math.ceil(numApples / applesPerRow);
      const appleGridWidth = applesPerRow * 25; // Increased spacing
      const appleSVGWidth = 450; // Much larger width
      const appleSVGHeight = 250; // Increased height
      const appleXOffset = (appleSVGWidth - appleGridWidth) / 2 + 12;
      const appleYStart = 40; // Better positioning
      
      for (let i = 0; i < numApples; i++) {
        const x = appleXOffset + (i % applesPerRow) * 25; // Increased spacing
        const y = appleYStart + Math.floor(i / applesPerRow) * 30; // Increased row spacing
        applesSVG += `<g><ellipse cx="${x}" cy="${y}" rx="11" ry="11" fill="#e74c3c" stroke="#b53c2e" stroke-width="2.5"/><rect x="${x-2.5}" y="${y-15}" width="5" height="10" fill="#8e5a1d"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${appleSVGWidth}" height="${appleSVGHeight}" style="display:block;margin:0 auto;">${applesSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numApples} apples (0.33 lbs each)</div>
      `;
    } else if (period === 'month') {
      // Month: Loaves of bread (1 lb each)
      const loafWeight = 1;
      const numLoaves = Math.max(1, Math.round(window.foodWasteData.month / loafWeight));
      let loavesSVG = '';
      const loavesPerCol = 6; // More per column for larger space
      const loavesCols = Math.ceil(numLoaves / loavesPerCol);
      const loafGridWidth = loavesCols * 35; // Increased spacing
      const loafSVGWidth = 450; // Much larger width
      const loafSVGHeight = 280; // Increased height
      const loafXOffset = (loafSVGWidth - loafGridWidth) / 2 + 17;
      const loafYStart = 40;
      
      for (let i = 0; i < numLoaves; i++) {
        const x = loafXOffset + Math.floor(i / loavesPerCol) * 35; // Increased spacing
        const y = loafYStart + (i % loavesPerCol) * 30; // Increased spacing
        loavesSVG += `<g><rect x="${x-12}" y="${y-10}" width="24" height="20" rx="7" fill="#e2b07a" stroke="#a67c52" stroke-width="2.5"/><ellipse cx="${x}" cy="${y-10}" rx="12" ry="7" fill="#fffbe6" opacity="0.7"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${loafSVGWidth}" height="${loafSVGHeight}" style="display:block;margin:0 auto;">${loavesSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numLoaves} loaves of bread (1 lb each)</div>
      `;
    } else if (period === 'year') {
      // Year: Watermelons (5 lbs each)
      const melonWeight = 5;
      const numMelons = Math.max(1, Math.round(window.foodWasteData.year / melonWeight));
      let melonsSVG = '';
      const melonsPerCol = 8; // More per column for larger space
      const melonsCols = Math.ceil(numMelons / melonsPerCol);
      const melonGridWidth = melonsCols * 40; // Increased spacing
      const melonSVGWidth = 480; // Much larger width
      const melonSVGHeight = 320; // Increased height
      const melonXOffset = (melonSVGWidth - melonGridWidth) / 2 + 20;
      const melonYStart = 40;
      
      for (let i = 0; i < numMelons; i++) {
        const x = melonXOffset + Math.floor(i / melonsPerCol) * 40; // Increased spacing
        const y = melonYStart + (i % melonsPerCol) * 32; // Increased spacing
        melonsSVG += `<g><ellipse cx="${x}" cy="${y}" rx="16" ry="16" fill="#a3c586" stroke="#4e7d3a" stroke-width="3"/><ellipse cx="${x}" cy="${y}" rx="10" ry="10" fill="#fff" opacity="0.15"/></g>`;
      }
      
      container.innerHTML = `
        <svg width="${melonSVGWidth}" height="${melonSVGHeight}" style="display:block;margin:0 auto;">${melonsSVG}</svg>
        <div style="text-align:center;font-size:1.4em;color:#666;margin-top:20px;font-weight:500;">That's about ${numMelons} watermelons (5 lbs each)</div>
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
    }
    
    // Fade back in
    setTimeout(() => {
      summaryElement.style.opacity = '1';
      summaryElement.style.transform = 'scale(1)';
    }, 50);
  }, 150);
}
