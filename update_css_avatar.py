import os

css_rules = """
.auth-avatar-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background-color: var(--action-color, #0da99f); /* Color turquesa/naranja corporativo */
    color: #ffffff;
    font-weight: 600;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid transparent;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    font-family: inherit;
    padding: 0;
}

.auth-avatar-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}
"""

with open('css/styles.css', 'a', encoding='utf-8') as f:
    f.write("\n" + css_rules)

print("CSS rules appended to css/styles.css")
