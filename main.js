/* Load CSV, then call tiny chart functions */
d3.csv("data/ReFED_US_State_Food_Surplus_Summary.csv", d3.autoType).then(data => {
    // skip first two metadata rows if present
    const clean = data.filter(d => typeof d.year === "number");
  
    drawTrend(clean);
    drawTopStates(clean, 2023);
    drawSectorBreakdown(clean, 2023);
  });
  
  function drawTrend(data) {
    const yearly = d3.rollup(
      data,
      v => d3.sum(v, d => d.tons_surplus),
      d => d.year
    );
    const entries = Array.from(yearly, ([year, tons]) => ({year, tons}));
  
    const w = 600, h = 300, margin = 40;
    const svg = d3.select("#trend")
        .append("svg")
        .attr("width", w)
        .attr("height", h);
  
    const x = d3.scaleLinear()
        .domain(d3.extent(entries, d => d.year))
        .range([margin, w - margin]);
  
    const y = d3.scaleLinear()
        .domain([0, d3.max(entries, d => d.tons)]).nice()
        .range([h - margin, margin]);
  
    svg.append("path")
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 2)
        .attr("d", d3.line()
            .x(d => x(d.year))
            .y(d => y(d.tons))
          (entries));
    
          const tooltip = d3.select("#trend")
          .append("div")
          .attr("class", "tooltip")
          .style("opacity", 0);
        
    svg.selectAll("circle")
        .data(entries)
        .enter().append("circle")
        .attr("cx", d => x(d.year))
        .attr("cy", d => y(d.tons))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .on("mouseover", (event, d) => {
            tooltip.transition().duration(150).style("opacity", .9);
            tooltip.html(
                `<strong>${d.year}</strong><br>${d3.format(",.2f")(d.tons/1e6)} M tons`
            )
            .style("left", (event.pageX + 12) + "px")
            .style("top",  (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            tooltip.transition().duration(150).style("opacity", 0);
        });
  
    svg.append("g")
        .attr("transform", `translate(0,${h - margin})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));
  
    svg.append("g")
        .attr("transform", `translate(${margin},0)`)
        .call(d3.axisLeft(y).ticks(5));
  }
  
  /* TODO: implement drawTopStates() and drawSectorBreakdown() in similar fashion */
  