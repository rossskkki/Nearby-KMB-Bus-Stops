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

    current_lat = 22.28314
    current_lon = 114.13716
    get_nearby_bus_stops(current_lat, current_lon).then(nearby_bus_stops => {
        console.log("Nearby Bus Stops:", nearby_bus_stops); 
    })

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

async function get_nearby_bus_stops(current_lat, current_lon){
    let limit_distance = document.getElementById("distance").value;
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
            nearby_bus_stops.push(bus_stop);
        }
    }
    return nearby_bus_stops;
}

function create_session_storage(key,data){
    sessionStorage.setItem(key, data);
}

function get_session_storage(key){
    return sessionStorage.getItem(key);
}