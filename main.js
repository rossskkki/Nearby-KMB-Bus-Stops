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

    current_lat = 22.28399
    current_lon = 114.13333
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
                        <div class="stop-info">Stop: <span id="${bus_stop.stop}" class="stop-name">${bus_stop.name_en}</span></div>
                    </div>
                    <div id="stop_${bus_stop.stop}" class="stop-detail"></div>
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
            const bus_stop_info = await get_bus_stop_info(stop_id);
            console.log("Bus Stop Info:", bus_stop_info); 
        } 
        catch (error) {
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
            // 使用路线号码和方向创建唯一标识
            const routeKey = `${route}_${dir}`;
            
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