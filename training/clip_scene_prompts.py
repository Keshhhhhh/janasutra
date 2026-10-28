"""Scene prompts for the CLIP civic-issue classifier: issue prompts map to a
taxonomy subcategory; "normal" prompts absorb ordinary scenes so an issue only
wins when the photo looks more like it than like a normal road/street."""
ISSUES = {
    "fallen_tree": ("Fallen tree / branch blocking the way", "TREE.FALLEN",
                    ["a photo of a fallen tree lying across a road", "a photo of a tree that fell on the street",
                     "a photo of a broken tree branch blocking a path"]),
    "garbage": ("Garbage dumped in public", "WASTE.DUMPING",
                ["a photo of a pile of garbage on the roadside", "a photo of trash dumped on a street",
                 "a photo of an overflowing garbage dump in a city"]),
    "flooding": ("Waterlogged / flooded road", "STORMWATER.WATERLOGGING",
                 ["a photo of a flooded road", "a photo of a street under water after rain",
                  "a photo of a waterlogged road with muddy water"]),
    "debris": ("Construction debris / rubble dumped", "WASTE.DUMPING",
               ["a photo of a pile of rubble and construction debris", "a photo of broken bricks and debris on a road"]),
    "open_manhole": ("Open manhole", "DRAIN.OPEN_MANHOLE",
                     ["a photo of an open manhole without a cover", "a photo of an uncovered manhole hole in the road"]),
    "damaged_pole": ("Fallen or damaged pole / streetlight", "LIGHT.POLE_DAMAGE",
                     ["a photo of a leaning electricity pole about to fall", "a photo of a fallen utility pole on a road",
                      "a photo of a bent and broken street light pole", "a photo of a knocked down lamp post"]),
    "overflowing_bin": ("Overflowing public bin", "WASTE.OVERFLOWING_BIN",
                        ["a photo of an overflowing public garbage bin", "a photo of a trash can overflowing with rubbish on a street"]),
}
NORMAL = ["a photo of a road", "a photo of a street with cars", "a photo of an asphalt road surface",
          "a photo of a cracked road", "a photo of a pothole in a road", "a photo of a closed manhole cover",
          "a photo of a city street", "a photo of trees beside a road", "a photo of a wet road after rain",
          "a photo of a building", "a photo of a person", "a photo of an indoor room",
          "a photo of a street light pole", "a photo of an electricity pole with wires", "a photo of a street lamp",
          "a photo of a garbage bin on a street", "a photo of railway overhead wires"]
