"""Neutral architectural SVG primitives for educational illustrations."""

import math


def knesset_svg(x, y, width, height):
    """Return a text-free, flag-free building group, contained in the given box."""
    try:
        x, y, width, height = map(float, (x, y, width, height))
    except (TypeError, ValueError) as exc:
        raise ValueError("SVG box values must be finite numbers") from exc
    if not all(map(math.isfinite, (x, y, width, height))) or width <= 0 or height <= 0:
        raise ValueError("SVG box must have finite coordinates and positive dimensions")

    scale = min(width / 1000, height / 600)
    tx, ty = x + (width - 1000 * scale) / 2, y + (height - 600 * scale) / 2
    cream, sage, deep = "#F7F8EF", "#A7BAB0", "#073E2A"
    shapes = [
        f'<g transform="translate({tx:.12g} {ty:.12g}) scale({scale:.12g})" stroke-linejoin="round">',
        # Forecourt and three broad steps, with the same rightward perspective.
        f'<path d="M30 540H795L970 453H205Z" fill="{sage}"/>',
        f'<path d="M50 500H800L950 425V448L800 523H50Z" fill="{sage}"/>',
        f'<path d="M50 500H800L950 425H200Z" fill="{cream}"/>',
        f'<path d="M70 477H790L931 407V427L790 497H70Z" fill="{sage}"/>',
        f'<path d="M70 477H790L931 407H211Z" fill="{cream}"/>',
        f'<path d="M90 454H780L915 387V407L780 474H90Z" fill="{sage}"/>',
        f'<path d="M90 454H780L915 387H225Z" fill="{cream}"/>',
        # Shaded side and recessed glazing; foreground columns provide rhythm.
        f'<path d="M780 212L915 145V387L780 454Z" fill="{sage}"/>',
        f'<path d="M795 225L901 172V377L795 430Z" fill="{deep}"/>',
        f'<path d="M828 208L842 201V407L828 414Z M870 187L883 181V387L870 393Z" fill="{sage}"/>',
        f'<rect x="96" y="212" width="688" height="242" fill="{cream}"/>',
        f'<rect x="110" y="231" width="660" height="207" fill="{deep}"/>',
        f'<path d="M110 307H770M110 370H770" fill="none" stroke="{sage}" stroke-width="5"/>',
    ]
    for index in range(10):
        column_x = 114 + index * 70
        shapes.append(f'<rect x="{column_x}" y="227" width="23" height="214" fill="{cream}"/>')
        shapes.append(f'<rect x="{column_x + 18}" y="233" width="5" height="203" fill="{sage}"/>')
    shapes.extend([
        f'<rect x="103" y="438" width="673" height="12" fill="{cream}"/>',
        # Broad, flat projecting roof; no dome, mast, flag or emblem.
        f'<path d="M60 189H791V215H60Z" fill="{cream}"/>',
        f'<path d="M791 189L950 110V136L791 215Z" fill="{sage}"/>',
        f'<path d="M60 189H791L950 110H219Z" fill="{cream}"/>',
        f'<path d="M75 203H783" fill="none" stroke="{sage}" stroke-width="3"/>',
        f'<path d="M89 529H775M817 501L929 445" fill="none" stroke="{deep}" stroke-width="3"/>',
        '</g>',
    ])
    return "".join(shapes)
