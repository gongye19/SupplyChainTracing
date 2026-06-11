from __future__ import annotations


COUNTRY_COORDINATES: dict[str, dict[str, object]] = {
    "CHN": {"country_name": "China", "latitude": 39.9042, "longitude": 116.4074, "region": "East Asia", "continent": "Asia"},
    "USA": {"country_name": "United States", "latitude": 38.9072, "longitude": -77.0369, "region": "North America", "continent": "North America"},
    "JPN": {"country_name": "Japan", "latitude": 35.6762, "longitude": 139.6503, "region": "East Asia", "continent": "Asia"},
    "KOR": {"country_name": "South Korea", "latitude": 37.5665, "longitude": 126.978, "region": "East Asia", "continent": "Asia"},
    "TWN": {"country_name": "Taiwan", "latitude": 25.033, "longitude": 121.5654, "region": "East Asia", "continent": "Asia"},
    "DEU": {"country_name": "Germany", "latitude": 52.52, "longitude": 13.405, "region": "Central Europe", "continent": "Europe"},
    "GBR": {"country_name": "United Kingdom", "latitude": 51.5074, "longitude": -0.1278, "region": "Western Europe", "continent": "Europe"},
    "FRA": {"country_name": "France", "latitude": 48.8566, "longitude": 2.3522, "region": "Western Europe", "continent": "Europe"},
    "NLD": {"country_name": "Netherlands", "latitude": 52.3676, "longitude": 4.9041, "region": "Western Europe", "continent": "Europe"},
    "SGP": {"country_name": "Singapore", "latitude": 1.2897, "longitude": 103.8501, "region": "Southeast Asia", "continent": "Asia"},
    "MYS": {"country_name": "Malaysia", "latitude": 3.139, "longitude": 101.6869, "region": "Southeast Asia", "continent": "Asia"},
    "THA": {"country_name": "Thailand", "latitude": 13.7563, "longitude": 100.5018, "region": "Southeast Asia", "continent": "Asia"},
    "VNM": {"country_name": "Vietnam", "latitude": 21.0285, "longitude": 105.8542, "region": "Southeast Asia", "continent": "Asia"},
    "PHL": {"country_name": "Philippines", "latitude": 14.5995, "longitude": 120.9842, "region": "Southeast Asia", "continent": "Asia"},
    "IDN": {"country_name": "Indonesia", "latitude": -6.2088, "longitude": 106.8456, "region": "Southeast Asia", "continent": "Asia"},
    "IND": {"country_name": "India", "latitude": 28.6139, "longitude": 77.209, "region": "South Asia", "continent": "Asia"},
    "HKG": {"country_name": "Hong Kong", "latitude": 22.3193, "longitude": 114.1694, "region": "East Asia", "continent": "Asia"},
    "AUS": {"country_name": "Australia", "latitude": -35.2809, "longitude": 149.13, "region": "Oceania", "continent": "Oceania"},
    "CAN": {"country_name": "Canada", "latitude": 45.4215, "longitude": -75.6972, "region": "North America", "continent": "North America"},
    "MEX": {"country_name": "Mexico", "latitude": 19.4326, "longitude": -99.1332, "region": "North America", "continent": "North America"},
    "BRA": {"country_name": "Brazil", "latitude": -15.7942, "longitude": -47.8822, "region": "South America", "continent": "South America"},
    "ITA": {"country_name": "Italy", "latitude": 41.9028, "longitude": 12.4964, "region": "Southern Europe", "continent": "Europe"},
    "ESP": {"country_name": "Spain", "latitude": 40.4168, "longitude": -3.7038, "region": "Southern Europe", "continent": "Europe"},
    "BEL": {"country_name": "Belgium", "latitude": 50.8503, "longitude": 4.3517, "region": "Western Europe", "continent": "Europe"},
    "CHE": {"country_name": "Switzerland", "latitude": 46.2044, "longitude": 6.1432, "region": "Central Europe", "continent": "Europe"},
    "SWE": {"country_name": "Sweden", "latitude": 59.3293, "longitude": 18.0686, "region": "Northern Europe", "continent": "Europe"},
    "IRL": {"country_name": "Ireland", "latitude": 53.3498, "longitude": -6.2603, "region": "Northern Europe", "continent": "Europe"},
    "CYP": {"country_name": "Cyprus", "latitude": 35.1856, "longitude": 33.3823, "region": "Western Asia", "continent": "Asia"},
    "AZE": {"country_name": "Azerbaijan", "latitude": 40.4093, "longitude": 49.8671, "region": "Western Asia", "continent": "Asia"},
    "CZE": {"country_name": "Czech Republic", "latitude": 50.0755, "longitude": 14.4378, "region": "Central Europe", "continent": "Europe"},
    "POL": {"country_name": "Poland", "latitude": 52.2297, "longitude": 21.0122, "region": "Central Europe", "continent": "Europe"},
    "RUS": {"country_name": "Russia", "latitude": 55.7558, "longitude": 37.6173, "region": "Eastern Europe", "continent": "Europe"},
    "TUR": {"country_name": "Turkey", "latitude": 39.9334, "longitude": 32.8597, "region": "Western Asia", "continent": "Asia"},
    "SAU": {"country_name": "Saudi Arabia", "latitude": 24.7136, "longitude": 46.6753, "region": "Western Asia", "continent": "Asia"},
    "ARE": {"country_name": "United Arab Emirates", "latitude": 24.4539, "longitude": 54.3773, "region": "Western Asia", "continent": "Asia"},
    "ISR": {"country_name": "Israel", "latitude": 31.7683, "longitude": 35.2137, "region": "Western Asia", "continent": "Asia"},
    "ZAF": {"country_name": "South Africa", "latitude": -25.7461, "longitude": 28.1881, "region": "Southern Africa", "continent": "Africa"},
    "EGY": {"country_name": "Egypt", "latitude": 30.0444, "longitude": 31.2357, "region": "Northern Africa", "continent": "Africa"},
    "ARG": {"country_name": "Argentina", "latitude": -34.6037, "longitude": -58.3816, "region": "South America", "continent": "South America"},
    "CHL": {"country_name": "Chile", "latitude": -33.4489, "longitude": -70.6693, "region": "South America", "continent": "South America"},
    "NZL": {"country_name": "New Zealand", "latitude": -41.2865, "longitude": 174.7762, "region": "Oceania", "continent": "Oceania"},
}


def locations_for_codes(codes: list[str]) -> list[dict[str, object]]:
    locations = []
    for code in sorted(set(codes)):
        meta = COUNTRY_COORDINATES.get(code)
        if not meta:
            continue
        locations.append({"country_code": code, **meta})
    return locations
