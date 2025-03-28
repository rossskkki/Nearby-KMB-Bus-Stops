let current_location;
let current_lat;
let current_lon;

function getloc(){
    return new Promise((resolve, reject) => {
        if(!navigator.geolocation){
            console.log("location not supported");
            reject("Geolocation not supported");
        }

        function success(position){
            let latitude = position.coords.latitude;
            let longitude = position.coords.longitude;
            console.log(latitude, longitude);
            resolve([latitude, longitude]);
        }

        function error(err){
            console.log("unable to retrieve your location");
            reject(err);
        }

        navigator.geolocation.getCurrentPosition(success, error);
    });
}

getloc().then(location => {
    current_location = location;
    current_lat = current_location[0];
    current_lon = current_location[1];

    // current_lat = 22.28399
    // current_lon = 114.13333
    let selection = document.getElementById("distance");

    async function updateBusStops() {
        try {
            const nearby_bus_stops = await get_nearby_bus_stops(current_lat, current_lon, selection.value);
            console.log("Nearby Bus Stops:", nearby_bus_stops);
            // Update UI
            if (nearby_bus_stops.length === 0) {
               let output = "<p>Cannot locate nearby bus stops</p>";
               document.getElementById("info-container").innerHTML = output;
               return;
            }
            let output = '<div class="bus-stops-container">';
            for (let i = 0; i < nearby_bus_stops.length; i++) {
                let bus_stop = nearby_bus_stops[i];
                output += `
                    <div class="bus-stop-item">
                        <div class="distance-info">Distance: ${bus_stop.distance}m</div>
                        <div class="stop-info">Stop: <span id="${bus_stop.stop}" class="stop-name" data-lat="${bus_stop.lat}" data-long="${bus_stop.long}" data-distance="${bus_stop.distance}">${bus_stop.name_en}</span></div>
                    </div>
                    <div class='cover-stop-detail'>
                        <div id="stop_${bus_stop.stop}" class="stop-detail"></div>
                        <div id="stop_${bus_stop.stop}_map" class="maps"></div>
                    </div>
                `;
            }
            output += '</div>';
            document.getElementById("info-container").innerHTML = output;
            
            // add event listener to bus stops
            let bus_stop_items = document.getElementsByClassName("stop-name");
            for (let i = 0; i < bus_stop_items.length; i++) {
                let bus_stop_item = bus_stop_items[i];
                bus_stop_item.addEventListener("click", display_bus_stop_info); 
            }
        } catch (error) {
            console.error("Error updating bus stops:", error);
        }
    }

    async function display_bus_stop_info(event) {
        try {
            const stop_id = event.target.id;
            const bus_stop_item = event.target.parentElement.parentElement;

            // remove previous bus stop info
            const allStopDetails = document.getElementsByClassName('stop-detail');
            for (let i = 0; i < allStopDetails.length; i++) {
                allStopDetails[i].innerHTML = '';
            }

            // remove highlighted class from all bus stops
            const allBusStops = document.getElementsByClassName('bus-stop-item');
            for (let item of allBusStops) {
                item.classList.remove('highlighted');
            }
            // add highlighted class to clicked bus stop
            bus_stop_item.classList.add('highlighted');
            const bus_stop_info = await get_bus_stop_info(stop_id);
            console.log("Bus Stop Info:", bus_stop_info); 

            //remove previous map
            const allMaps = document.getElementsByClassName('maps');
            for (let i = 0; i < allMaps.length; i++) {
                allMaps[i].innerHTML = '';
                allMaps[i].classList.remove('map-size')
            }
            // add map size
            let map = document.getElementById(`stop_${stop_id}_map`);
            map.classList.add('map-size');

            let stop_lat = Number(event.target.dataset.lat);
            let stop_long = Number(event.target.dataset.long);
            console.log("Stop Latitude:", stop_lat);
            console.log("Stop Longitude:", stop_long);
            console.log("Current Latitude:", current_lat);
            console.log("Current Longitude:", current_lon);
            let middle_lat = (stop_lat + current_lat) / 2;
            let middle_long = (stop_long + current_lon) / 2;
            let middle_point = [middle_long, middle_lat];
            console.log("Middle Point:", middle_point);

            // add map
            var gmap = new ol.Map({
                target: map,
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.OSM()
                    })
                ],
                view: new ol.View({
                    center: ol.proj.fromLonLat(middle_point),
                    zoom: getAppropriateZoom(Number(event.target.dataset.distance))
                })
            });
            
            // create a feature for the current position
            const currentPositionFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([current_lon, current_lat]))
            });
            
            // create a style for the current position marker
            currentPositionFeature.setStyle(new ol.style.Style({
                image: new ol.style.Icon({
                    src: 'map-marker.ico',
                    scale: 0.5,
                    anchor: [0.5, 1]
                })
            }));
            
            // create a feature for the bus stop
            const busStopFeature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([stop_long, stop_lat]))
            });
            
            // create a style for the bus stop marker
            busStopFeature.setStyle(new ol.style.Style({
                image: new ol.style.Icon({
                    src: 'bus-icon.ico',
                    scale: 0.8,
                    anchor: [0.5, 0.5]
                })
            }));
            
            // create a vector layer to hold the features
            const vectorLayer = new ol.layer.Vector({
                source: new ol.source.Vector({
                    features: [currentPositionFeature, busStopFeature]
                })
            });
            
            // add the vector layer to the map
            gmap.addLayer(vectorLayer);
            
            // ensure the zoom level is appropriate
            function getAppropriateZoom(distance) {
                console.log("Distance:", distance);
                if (distance < 50) {
                    return 19;
                } else if (distance < 200) {
                    return 18;
                } else if (distance < 350) {
                    return 17;
                } else {
                    return 16;
                }
            }

            // Check if there is any bus route information
            if (Object.keys(bus_stop_info).length === 0) {
                console.log("No bus route information");
                let output = "<p>No bus route information</p>";
                document.getElementById(`stop_${stop_id}`).innerHTML = output;
                const mapElement = document.getElementById(`stop_${stop_id}_map`);
                mapElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest',    
                    inline: 'nearest' 
                });
                return;
            }

            let output = "<div class='stop-detail-container'>";
            // Check if there are any routes with the same route number but different direction
            const routes = {};
            for (const routeKey in bus_stop_info) {
                const routeNumber = routeKey.split('(')[0];
                if (!routes[routeNumber]) {
                    routes[routeNumber] = [];
                }
                routes[routeNumber].push(routeKey);
            }

            // Display routes according to the route number and direction
            for (const routeNumber in routes) {
                const routeKeys = routes[routeNumber];
                if (routeKeys.length > 1) {
                    // two directions, routeKey
                    routeKeys.forEach(routeKey => {
                        const [etas, dir, type, dest] = bus_stop_info[routeKey];
                        output += `<div class='stop-detail-item-container'>
                                        <div class= 'stop-detail-info'>
                                            <span class='stop-detail-route'>${routeKey}</span>  
                                            <span class='stop-detail-dest'>${dest}</span>
                                        </div>
                                        <div class='eta-container'>
                                            <span class='eta-label'>ETA: </span>${etas.map(eta => {
                                            const etaTime = new Date(eta);
                                            //time format
                                            return `<span class='eta-time'>${etaTime.toLocaleString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })}</span>`;
                                    }).join('')}</div>
                                   </div>`;
                    });
                } else {
                    // one direction, routeNumber
                    const routeKey = routeKeys[0];
                    const [etas, dir, type, dest] = bus_stop_info[routeKey];
                    output += `<div class='stop-detail-item-container'>
                                <div class= 'stop-detail-info'>
                                    <span class='stop-detail-route'>${routeNumber}</span>  
                                    <span class='stop-detail-dest'>${dest}</span>
                                </div>
                                <div class='eta-container'>
                                    <span class='eta-label'>ETA: </span>${etas.map(eta => {
                                    const etaTime = new Date(eta);
                                    //time format
                                    return `<span class='eta-time'>${etaTime.toLocaleString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })}</span>`;
                            }).join('')}</div>
                        </div>`;
                }
            }
            output += "</div>";
            const detailElement = document.getElementById(`stop_${stop_id}`);
            detailElement.innerHTML = output;
    
            //  displays the information of the selected bus stop within the browser window
            const mapElement = document.getElementById(`stop_${stop_id}_map`);
            mapElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'nearest',    
                inline: 'nearest'   
            });
        }catch (error) {
            console.error("Error displaying bus stop info:", error); 
        }
    }

    // initial update
    updateBusStops();

    // add event listener to selection
    selection.addEventListener("change", updateBusStops);


}).catch(err => {
    console.error(err);
});

function get_distance_diff(lat1, lon1, lat2, lon2){
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    const d = R * c; // in metres 
    return d;
}

async function get_nearby_bus_stops(current_lat, current_lon,limit_distance){
    let nearby_bus_stops = [];
    
    // get all bus stops from session storage
    let all_bus_stops = get_session_storage("KMB Bus Stops");
    if(!all_bus_stops){
        try {
            const response = await fetch("https://data.etabus.gov.hk/v1/transport/kmb/stop");
            const JSONData = await response.json();
            const data = JSONData.data;
            // store data in session storage
            create_session_storage("KMB Bus Stops", JSON.stringify(data));
            all_bus_stops = data;
        } catch (error) {
            console.error("Error fetching bus stops:", error);
            return;
        }
    } else {
        all_bus_stops = JSON.parse(all_bus_stops);
    }

    console.log("All Bus Stops:", all_bus_stops);
    
    // get nearby bus stops
    for (let i = 0; i < all_bus_stops.length; i++) {
        let bus_stop = all_bus_stops[i];
        let bus_stop_lat = bus_stop.lat;
        let bus_stop_lon = bus_stop.long; 
        let distance = get_distance_diff(current_lat, current_lon, bus_stop_lat, bus_stop_lon);
        // console.log("Distance:", distance);
        // console.log("Limit Distance:", limit_distance);
        if(distance <= limit_distance){
            bus_stop.distance = distance.toFixed(0);
            nearby_bus_stops.push(bus_stop);
        }
    }
    nearby_bus_stops.sort((a, b) => a.distance - b.distance);
    return nearby_bus_stops;
}

function create_session_storage(key,data){
    sessionStorage.setItem(key, data);
}

function get_session_storage(key){
    return sessionStorage.getItem(key);
}

async function get_bus_stop_info(stop_id){
    try {
        const response = await fetch(`https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${stop_id}`);
        const JSONData = await response.json();
        const data = JSONData.data;
        console.log("Bus Stop Row Info:", data);
        const resData = {};
        
        for (let i = 0; i < data.length; i++) {
            const { route, service_type, dir, dest_en, eta } = data[i];
            // use route and dir as key
            const routeKey = `${route}(${dir === 'O' ? 'outbound' : 'inbound'})`;
            
            if (eta === null) continue;
            
            if (resData[routeKey]) {
                if (service_type === resData[routeKey][2]) {
                    resData[routeKey][0].push(eta);
                } else {
                    console.log("Different Service Type");
                }
                continue;
            }
            
            resData[routeKey] = [[eta], dir, service_type, dest_en];
        }
        return resData;
    } catch (error) {
        console.error("Error fetching bus stop info:", error);
        return;
    }
}