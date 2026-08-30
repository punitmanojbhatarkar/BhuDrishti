import os
import urllib.request

os.makedirs("../frontend/public/demo", exist_ok=True)

images = {
    "flood.jpg": "https://images.unsplash.com/photo-1469122312224-c5846569feb1?q=80&w=800&auto=format&fit=crop", # Water covering land
    "agri.jpg": "https://images.unsplash.com/photo-1586771107445-d3ca888129ff?q=80&w=800&auto=format&fit=crop", # Agriculture fields
    "urban.jpg": "https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=800&auto=format&fit=crop", # Aerial city
    "forest.jpg": "https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop", # Forest aerial
    "water.jpg": "https://images.unsplash.com/photo-1439405326854-014607f694d7?q=80&w=800&auto=format&fit=crop", # Sea/lake
    "general.jpg": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=800&auto=format&fit=crop" # Earth from space
}

for name, url in images.items():
    path = f"../frontend/public/demo/{name}"
    print(f"Downloading {name}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(path, 'wb') as out_file:
        out_file.write(response.read())

print("All demo images downloaded!")
